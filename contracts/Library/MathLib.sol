pragma solidity ^0.4.18;

library MathLib {
    uint public constant INT_MAX = 57896044618658097711785492504343953926634992332820282019728792003956564819967;  // 2**255 - 1

    /**
     * Return the larger of a or b.  Returns a if a == b.
     */
    function max(uint a, uint b) 
        public pure returns (uint)
    {
        if (a >= b) {
            return a;
        } else {
            return b;
        }
    }

    /**
     * Return the smaller of a or b.  Returns a if a == b.
     */
    function min(uint a, uint b) 
        public pure returns (uint)
    {
        if (a <= b) {
            return a;
        } else {
            return b;
        }
    }

    /**
     * Returns `a` represented as a signed integer in a manner that throws an
     * exception if casting to signed integer would result in a negative
     * number.
     */
    function safeCastSigned(uint a) 
        public pure returns (int)
    {
        assert(a <= INT_MAX);
        return int(a);
    }
}
