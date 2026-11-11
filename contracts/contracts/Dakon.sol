// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Dakon — congklak between two wallets, refereed move by move on BOT Chain
/// @notice One opener sits South and picks the board size and pace. A challenger sits North and
/// moves first. Every move is a transaction; this contract runs the whole sowing, relay,
/// capture and end-of-game rules, so an illegal move cannot get through.
///
/// There is no wager, no token, no payable function and no owner. Once deployed, nobody can
/// change the rules or a result.
///
/// The rules are written twice: here, as the referee, and in web/src/engine/rules.ts for
/// animation, practice and replay. A differential test plays hundreds of random games through
/// both and requires identical boards after every move.
contract Dakon {
    // ───────────────────────────── Board layout ─────────────────────────────
    //
    // A board is sixteen 8-bit cells packed into one uint256, cell i in bits 8i..8i+7:
    //   0..6   South holes (only 0..size-1 are used)
    //   7      South store
    //   8..14  North holes (only 8..8+size-1 are used)
    //   15     North store
    // Sowing order: South holes, South store, North holes, North store, then round again,
    // skipping the mover's opponent's store. South hole i faces North hole size-1-i.

    uint8 public constant SOUTH = 0;
    uint8 public constant NORTH = 1;

    /// @notice Sowing stops after this many seeds in one move, so no move can run out of gas.
    uint256 public constant MAX_SOWN = 1200;
    uint256 public constant NICKNAME_MAX_BYTES = 20;
    uint256 public constant PAGE_MAX = 100;

    // Table status
    uint8 internal constant WAITING = 0;
    uint8 internal constant PLAYING = 1;
    uint8 internal constant FINISHED = 2;
    uint8 internal constant CANCELLED = 3;

    // Result: 0 none yet, 1 South won, 2 North won, 3 draw
    uint8 internal constant RESULT_SOUTH = 1;
    uint8 internal constant RESULT_NORTH = 2;
    uint8 internal constant RESULT_DRAW = 3;

    // Why a game ended: 0 not ended, 1 seeds ran out, 2 a player resigned, 3 time ran out
    uint8 internal constant REASON_BOARD = 1;
    uint8 internal constant REASON_RESIGN = 2;
    uint8 internal constant REASON_TIMEOUT = 3;

    // How a move ended, as emitted in MovePlayed and returned by the previews
    uint8 internal constant OUTCOME_EXTRA = 0; //   last seed in own store: move again
    uint8 internal constant OUTCOME_CAPTURE = 1; // last seed in an empty own hole, opposite taken
    uint8 internal constant OUTCOME_REST = 2; //    last seed in an empty own hole, opposite empty
    uint8 internal constant OUTCOME_DEAD = 3; //    last seed in an empty hole across the board
    uint8 internal constant OUTCOME_LIMIT = 4; //   MAX_SOWN reached

    // ───────────────────────────── Storage ─────────────────────────────

    struct Table {
        // slot 0 — read and written on every move
        address south;
        uint8 size;
        uint8 pace;
        uint8 status;
        uint8 turn;
        uint8 result;
        uint8 reason;
        uint40 lastMoveAt;
        // slot 1
        address north;
        uint40 createdAt;
        uint40 endedAt;
        // slot 2
        address invited;
        // slot 3 — the whole board in one slot
        uint256 board;
        // one byte per move: bit 7 set when North moved, low bits the hole
        bytes moves;
    }

    struct Player {
        uint32 wins;
        uint32 losses;
        uint32 draws;
        uint16 bestStore;
        bool listed;
        string nickname;
    }

    struct Counters {
        uint64 tables;
        uint64 playing;
        uint64 finished;
        uint64 moves;
    }

    mapping(uint256 => Table) internal _tables;
    mapping(address => Player) internal _players;
    mapping(address => uint256[]) internal _tablesOf;
    address[] internal _playerList;
    Counters internal _counters;

    // ───────────────────────────── Views ─────────────────────────────

    struct TableView {
        uint256 id;
        address south;
        address north;
        address invited;
        uint8 size;
        uint8 pace;
        uint8 status;
        uint8 turn;
        uint8 result;
        uint8 reason;
        uint40 createdAt;
        uint40 lastMoveAt;
        uint40 endedAt;
        /// @dev While a game is being played: the moment the player to move runs out of time.
        uint40 deadline;
        uint32 moveCount;
        uint8[16] board;
    }

    /// @dev What a move would do. `code` is 0 for a legal move; see previewMove for the others.
    struct MovePreview {
        uint8 code;
        uint8[16] board;
        uint8 next;
        bool ended;
        uint8 outcome;
        uint16 sown;
    }

    /// @dev The result of sowing, kept in memory to stay clear of the stack limit.
    struct Sowing {
        uint256 board;
        uint256 next;
        bool ended;
        uint256 outcome;
        uint256 sown;
    }

    struct PlayerView {
        address wallet;
        string nickname;
        uint32 wins;
        uint32 losses;
        uint32 draws;
        uint16 bestStore;
        uint32 tables;
    }

    // ───────────────────────────── Events ─────────────────────────────

    event TableOpened(uint256 indexed id, address indexed south, uint8 size, uint8 pace, address invited);
    event TableCancelled(uint256 indexed id);
    event PlayerSat(uint256 indexed id, address indexed north);
    event MovePlayed(uint256 indexed id, address indexed player, uint8 hole, uint8 outcome, uint16 sown);
    event GameEnded(uint256 indexed id, uint8 result, uint8 reason, uint8 southStore, uint8 northStore);
    event NicknameSet(address indexed wallet, string nickname);

    // ───────────────────────────── Errors ─────────────────────────────

    error InvalidSize();
    error InvalidPace();
    error CannotInviteYourself();
    error TableNotFound();
    error TableNotWaiting();
    error NotTheOpener();
    error OpenerCannotSit();
    error NotInvited();
    error GameNotInPlay();
    error NotAPlayer();
    error NotYourTurn();
    error InvalidHole();
    error EmptyHole();
    error YourOwnMove();
    error TimeNotUp(uint256 deadline);
    error NicknameTooLong();
    error InvalidBoard();

    // ───────────────────────────── Writes ─────────────────────────────

    /// @notice Opens a table. `size` is 5 (Ringkas) or 7 (Klasik); `pace` 0, 1 or 2 sets the
    /// time per move (3 minutes, 1 hour, 24 hours). `invited` reserves the North seat for one
    /// wallet; the zero address leaves it open to anyone.
    function openTable(uint8 size, uint8 pace, address invited) external returns (uint256 id) {
        if (size != 5 && size != 7) revert InvalidSize();
        if (pace > 2) revert InvalidPace();
        if (invited == msg.sender) revert CannotInviteYourself();

        id = ++_counters.tables;
        Table storage t = _tables[id];
        t.south = msg.sender;
        t.size = size;
        t.pace = pace;
        t.turn = NORTH;
        t.createdAt = uint40(block.timestamp);
        t.lastMoveAt = uint40(block.timestamp);
        if (invited != address(0)) t.invited = invited;
        t.board = _initialBoard(size);

        _tablesOf[msg.sender].push(id);
        _list(msg.sender);
        emit TableOpened(id, msg.sender, size, pace, invited);
    }

    /// @notice The opener may take a table down while nobody has sat at it.
    function cancelTable(uint256 id) external {
        Table storage t = _table(id);
        if (t.status != WAITING) revert TableNotWaiting();
        if (msg.sender != t.south) revert NotTheOpener();
        t.status = CANCELLED;
        t.endedAt = uint40(block.timestamp);
        emit TableCancelled(id);
    }

    /// @notice Takes the North seat. The game starts at once and North moves first.
    function sit(uint256 id) external {
        Table storage t = _table(id);
        if (t.status != WAITING) revert TableNotWaiting();
        if (msg.sender == t.south) revert OpenerCannotSit();
        address invited = t.invited;
        if (invited != address(0) && invited != msg.sender) revert NotInvited();

        t.north = msg.sender;
        t.status = PLAYING;
        t.lastMoveAt = uint40(block.timestamp);
        _counters.playing += 1;

        _tablesOf[msg.sender].push(id);
        _list(msg.sender);
        emit PlayerSat(id, msg.sender);
    }

    /// @notice Lifts every seed from `hole` (0-based, on the mover's own side) and sows them.
    function play(uint256 id, uint8 hole) external {
        Table storage t = _table(id);
        if (t.status != PLAYING) revert GameNotInPlay();
        uint8 turn = t.turn;
        address mover = turn == SOUTH ? t.south : t.north;
        if (msg.sender != mover) {
            if (msg.sender == t.south || msg.sender == t.north) revert NotYourTurn();
            revert NotAPlayer();
        }
        uint8 size = t.size;
        if (hole >= size) revert InvalidHole();
        uint256 board = t.board;
        if ((board >> ((uint256(turn) * 8 + hole) * 8)) & 0xff == 0) revert EmptyHole();

        Sowing memory r = _sow(board, size, turn, hole);

        t.board = r.board;
        t.moves.push(bytes1((turn == NORTH ? 0x80 : 0) | hole));
        _counters.moves += 1;
        emit MovePlayed(id, msg.sender, hole, uint8(r.outcome), uint16(r.sown));

        t.turn = uint8(r.next);
        if (r.ended) {
            uint256 southStore = (r.board >> 56) & 0xff;
            uint256 northStore = (r.board >> 120) & 0xff;
            uint8 result = southStore > northStore ? RESULT_SOUTH : northStore > southStore ? RESULT_NORTH : RESULT_DRAW;
            _finish(id, t, result, REASON_BOARD, southStore, northStore);
        } else {
            t.lastMoveAt = uint40(block.timestamp);
        }
    }

    /// @notice Either player may resign at any point of a game in play.
    function resign(uint256 id) external {
        Table storage t = _table(id);
        if (t.status != PLAYING) revert GameNotInPlay();
        uint8 result;
        if (msg.sender == t.south) result = RESULT_NORTH;
        else if (msg.sender == t.north) result = RESULT_SOUTH;
        else revert NotAPlayer();
        uint256 board = t.board;
        _finish(id, t, result, REASON_RESIGN, (board >> 56) & 0xff, (board >> 120) & 0xff);
    }

    /// @notice When the player to move has let their time run out, the other player may
    /// claim the game. Until someone claims, a late move is still accepted.
    function claimTimeout(uint256 id) external {
        Table storage t = _table(id);
        if (t.status != PLAYING) revert GameNotInPlay();
        uint8 claimer;
        if (msg.sender == t.south) claimer = SOUTH;
        else if (msg.sender == t.north) claimer = NORTH;
        else revert NotAPlayer();
        if (claimer == t.turn) revert YourOwnMove();
        uint256 deadline = uint256(t.lastMoveAt) + _paceSeconds(t.pace);
        if (block.timestamp <= deadline) revert TimeNotUp(deadline);
        uint256 board = t.board;
        _finish(
            id,
            t,
            claimer == SOUTH ? RESULT_SOUTH : RESULT_NORTH,
            REASON_TIMEOUT,
            (board >> 56) & 0xff,
            (board >> 120) & 0xff
        );
    }

    /// @notice Sets the name shown instead of your address. Up to 20 bytes; empty clears it.
    function setNickname(string calldata nickname) external {
        if (bytes(nickname).length > NICKNAME_MAX_BYTES) revert NicknameTooLong();
        _players[msg.sender].nickname = nickname;
        _list(msg.sender);
        emit NicknameSet(msg.sender, nickname);
    }

    // ───────────────────────────── Reads ─────────────────────────────

    function tableCount() external view returns (uint256) {
        return _counters.tables;
    }

    function getTable(uint256 id) external view returns (TableView memory) {
        _table(id);
        return _view(id);
    }

    /// @notice Newest first. Pass cursor 0 to start from the newest table; pass the returned
    /// `next` to continue. `next` is 0 when there is nothing older left.
    function getTables(uint256 cursor, uint256 limit) external view returns (TableView[] memory page, uint256 next) {
        uint256 total = _counters.tables;
        uint256 start = cursor == 0 || cursor > total ? total : cursor;
        if (limit > PAGE_MAX) limit = PAGE_MAX;
        uint256 n = start < limit ? start : limit;
        page = new TableView[](n);
        for (uint256 i; i < n; ++i) page[i] = _view(start - i);
        next = start > n ? start - n : 0;
    }

    /// @notice Tables by id. An id that does not exist comes back as an empty entry (id 0).
    function getTablesByIds(uint256[] calldata ids) external view returns (TableView[] memory page) {
        uint256 total = _counters.tables;
        page = new TableView[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            uint256 id = ids[i];
            if (id != 0 && id <= total) page[i] = _view(id);
        }
    }

    /// @notice Every table a wallet opened or sat at, oldest first.
    function tablesOf(address wallet) external view returns (uint256[] memory) {
        return _tablesOf[wallet];
    }

    /// @notice The move log, one byte per move: bit 7 set when North moved, low bits the hole.
    function getMoves(uint256 id) external view returns (bytes memory) {
        return _table(id).moves;
    }

    /// @notice What `play(id, hole)` would do for the player whose turn it is.
    /// `code`: 0 legal, 1 no such table, 2 game not in play, 3 hole off the board, 4 hole empty.
    /// For codes 2 to 4 the current board is returned unchanged.
    function previewMove(uint256 id, uint8 hole) external view returns (MovePreview memory p) {
        if (id == 0 || id > _counters.tables) {
            p.code = 1;
            return p;
        }
        Table storage t = _tables[id];
        uint256 packed = t.board;
        p.next = t.turn;
        if (t.status != PLAYING) p.code = 2;
        else if (hole >= t.size) p.code = 3;
        else if ((packed >> ((uint256(t.turn) * 8 + hole) * 8)) & 0xff == 0) p.code = 4;
        if (p.code != 0) {
            p.board = _unpack(packed);
            return p;
        }
        _fill(p, _sow(packed, t.size, t.turn, hole));
    }

    /// @notice Runs the rules on any board, for anyone who wants to check them. Holds no state.
    function simulateMove(uint8 size, uint8[16] calldata board, uint8 side, uint8 hole)
        external
        pure
        returns (MovePreview memory p)
    {
        if (size != 5 && size != 7) revert InvalidSize();
        if (side > 1) revert NotAPlayer();
        if (hole >= size) revert InvalidHole();
        uint256 packed;
        uint256 total;
        for (uint256 i; i < 16; ++i) {
            total += board[i];
            packed |= uint256(board[i]) << (8 * i);
        }
        // Every seed must fit in one cell, as it always does in a real game (at most 98 seeds).
        if (total > 255) revert InvalidBoard();
        if (board[side * 8 + hole] == 0) revert EmptyHole();
        _fill(p, _sow(packed, size, side, hole));
    }

    function playerOf(address wallet) external view returns (PlayerView memory) {
        return _playerView(wallet);
    }

    /// @notice Players in the order they first appeared. Pass cursor 0 to start; `next` is 0
    /// when the list is done.
    function getPlayers(uint256 cursor, uint256 limit) external view returns (PlayerView[] memory page, uint256 next) {
        uint256 total = _playerList.length;
        if (limit > PAGE_MAX) limit = PAGE_MAX;
        if (cursor >= total) return (new PlayerView[](0), 0);
        uint256 end = cursor + limit < total ? cursor + limit : total;
        page = new PlayerView[](end - cursor);
        for (uint256 i = cursor; i < end; ++i) page[i - cursor] = _playerView(_playerList[i]);
        next = end < total ? end : 0;
    }

    function getNicknames(address[] calldata wallets) external view returns (string[] memory names) {
        names = new string[](wallets.length);
        for (uint256 i; i < wallets.length; ++i) names[i] = _players[wallets[i]].nickname;
    }

    function stats()
        external
        view
        returns (uint256 tables, uint256 playing, uint256 finished, uint256 moves, uint256 players)
    {
        Counters memory c = _counters;
        return (c.tables, c.playing, c.finished, c.moves, _playerList.length);
    }

    // ───────────────────────────── Rules ─────────────────────────────

    /// @dev Plays one move on a packed board, entirely in memory. The caller has checked that
    /// `hole` is on the board and holds seeds. In the result, `next` is whose move it is next
    /// (when the game ended: the side that could not move) and `sown` counts every seed
    /// dropped, relays included.
    function _sow(uint256 packed, uint256 size, uint256 side, uint256 hole) internal pure returns (Sowing memory r) {
        uint256[16] memory b;
        unchecked {
            for (uint256 i; i < 16; ++i) b[i] = (packed >> (i * 8)) & 0xff;

            uint256 own = side * 8 + 7; // the opponent's store is own ^ 8
            uint256 cell = side * 8 + hole;
            uint256 hand = b[cell];
            uint256 sown;
            b[cell] = 0;

            while (true) {
                while (hand != 0) {
                    cell = _next(cell, size);
                    if (cell == (own ^ 8)) cell = _next(cell, size);
                    b[cell] += 1;
                    --hand;
                    ++sown;
                }

                if (cell == own) {
                    r.outcome = OUTCOME_EXTRA;
                    break;
                }
                if (b[cell] > 1) {
                    // Landed on seeds: lift them all and keep sowing.
                    if (sown >= MAX_SOWN) {
                        r.outcome = OUTCOME_LIMIT;
                        break;
                    }
                    hand = b[cell];
                    b[cell] = 0;
                    continue;
                }
                // The last seed fell into an empty hole.
                if (cell >> 3 == side) {
                    uint256 across = size + 7 - cell;
                    uint256 taken = b[across];
                    if (taken != 0) {
                        b[own] += taken + 1;
                        b[across] = 0;
                        b[cell] = 0;
                        r.outcome = OUTCOME_CAPTURE;
                    } else {
                        r.outcome = OUTCOME_REST;
                    }
                } else {
                    r.outcome = OUTCOME_DEAD;
                }
                break;
            }
            r.sown = sown;
            r.next = r.outcome == OUTCOME_EXTRA ? side : side ^ 1;

            // The side to move with an empty row ends the game; the other side keeps its seeds.
            uint256 base = r.next * 8;
            uint256 left;
            for (uint256 i; i < size; ++i) left += b[base + i];
            if (left == 0) {
                r.ended = true;
                base = (r.next ^ 1) * 8;
                uint256 swept;
                for (uint256 i; i < size; ++i) {
                    swept += b[base + i];
                    b[base + i] = 0;
                }
                b[base + 7] += swept;
            }

            uint256 out;
            for (uint256 i; i < 16; ++i) out |= b[i] << (i * 8);
            r.board = out;
        }
    }

    /// @dev The next cell in sowing order, before skipping the opponent's store.
    function _next(uint256 cell, uint256 size) private pure returns (uint256) {
        unchecked {
            if (cell == 15) return 0;
            if (cell == size - 1) return 7;
            if (cell == 7) return 8;
            if (cell == size + 7) return 15;
            return cell + 1;
        }
    }

    function _fill(MovePreview memory p, Sowing memory r) private pure {
        p.board = _unpack(r.board);
        p.next = uint8(r.next);
        p.ended = r.ended;
        p.outcome = uint8(r.outcome);
        p.sown = uint16(r.sown);
    }

    function _initialBoard(uint256 size) internal pure returns (uint256 packed) {
        for (uint256 i; i < size; ++i) {
            packed |= (size << (8 * i)) | (size << (8 * (8 + i)));
        }
    }

    function _unpack(uint256 packed) internal pure returns (uint8[16] memory board) {
        for (uint256 i; i < 16; ++i) board[i] = uint8(packed >> (8 * i));
    }

    function _paceSeconds(uint8 pace) internal pure returns (uint256) {
        if (pace == 0) return 3 minutes;
        if (pace == 1) return 1 hours;
        return 24 hours;
    }

    // ───────────────────────────── Internals ─────────────────────────────

    function _table(uint256 id) internal view returns (Table storage t) {
        if (id == 0 || id > _counters.tables) revert TableNotFound();
        t = _tables[id];
    }

    function _finish(uint256 id, Table storage t, uint8 result, uint8 reason, uint256 southStore, uint256 northStore)
        internal
    {
        t.status = FINISHED;
        t.result = result;
        t.reason = reason;
        t.endedAt = uint40(block.timestamp);
        _counters.playing -= 1;
        _counters.finished += 1;

        Player storage s = _players[t.south];
        Player storage n = _players[t.north];
        if (result == RESULT_SOUTH) {
            s.wins += 1;
            n.losses += 1;
        } else if (result == RESULT_NORTH) {
            n.wins += 1;
            s.losses += 1;
        } else {
            s.draws += 1;
            n.draws += 1;
        }
        // Best store counts only games played out to the last seed.
        if (reason == REASON_BOARD) {
            if (southStore > s.bestStore) s.bestStore = uint16(southStore);
            if (northStore > n.bestStore) n.bestStore = uint16(northStore);
        }
        emit GameEnded(id, result, reason, uint8(southStore), uint8(northStore));
    }

    function _list(address wallet) internal {
        Player storage p = _players[wallet];
        if (!p.listed) {
            p.listed = true;
            _playerList.push(wallet);
        }
    }

    function _view(uint256 id) internal view returns (TableView memory v) {
        Table storage t = _tables[id];
        v.id = id;
        v.south = t.south;
        v.north = t.north;
        v.invited = t.invited;
        v.size = t.size;
        v.pace = t.pace;
        v.status = t.status;
        v.turn = t.turn;
        v.result = t.result;
        v.reason = t.reason;
        v.createdAt = t.createdAt;
        v.lastMoveAt = t.lastMoveAt;
        v.endedAt = t.endedAt;
        if (t.status == PLAYING) v.deadline = uint40(uint256(t.lastMoveAt) + _paceSeconds(t.pace));
        v.moveCount = uint32(t.moves.length);
        v.board = _unpack(t.board);
    }

    function _playerView(address wallet) internal view returns (PlayerView memory v) {
        Player storage p = _players[wallet];
        v.wallet = wallet;
        v.nickname = p.nickname;
        v.wins = p.wins;
        v.losses = p.losses;
        v.draws = p.draws;
        v.bestStore = p.bestStore;
        v.tables = uint32(_tablesOf[wallet].length);
    }
}
