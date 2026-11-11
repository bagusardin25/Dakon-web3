// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Dakon} from "../Dakon.sol";

/// @dev TEST ONLY — never deployed. Lets a test place any position on a table in play, so
/// rare positions (the longest relays, the sowing limit) can be measured through `play`.
contract DakonHarness is Dakon {
    function forceBoard(uint256 id, uint8[16] calldata board, uint8 turn) external {
        Table storage t = _table(id);
        uint256 packed;
        for (uint256 i; i < 16; ++i) packed |= uint256(board[i]) << (8 * i);
        t.board = packed;
        t.turn = turn;
    }
}
