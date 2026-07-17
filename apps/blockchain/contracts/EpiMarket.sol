// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract EpiMarket {
    enum Outcome {
        NONE,
        YES,
        NO
    }

    struct Market {
        uint256 yesPool;
        uint256 noPool;
        uint256 totalVolume;
        bool resolved;
        Outcome outcome;
        bool exists;
    }

    struct BetRecord {
        address bettor;
        Outcome side;
        uint256 amount;
        uint256 payout;
    }

    string public constant name = "EpiMarket Token";
    string public constant symbol = "EPIM";
    uint8 public constant decimals = 2;

    uint256 public constant SEED_LIQUIDITY = 50 * 10 ** decimals;

    address public owner;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    mapping(string => Market) public markets;
    mapping(string => BetRecord[]) private marketBets;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event MarketCreated(string marketId);
    event BetPlaced(string indexed marketId, address indexed bettor, Outcome side, uint256 amount);
    event MarketResolved(string marketId, Outcome outcome, uint256 totalPool);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "Allowance exceeded");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function createMarket(string calldata marketId) external onlyOwner {
        require(!markets[marketId].exists, "Market already exists");
        markets[marketId] = Market({
            yesPool: SEED_LIQUIDITY,
            noPool: SEED_LIQUIDITY,
            totalVolume: 0,
            resolved: false,
            outcome: Outcome.NONE,
            exists: true
        });
        emit MarketCreated(marketId);
    }

    function placeBet(string calldata marketId, Outcome side, uint256 amount) external {
        require(side == Outcome.YES || side == Outcome.NO, "side must be YES or NO");
        require(amount > 0, "amount must be positive");

        Market storage market = markets[marketId];
        require(market.exists, "Market not found");
        require(!market.resolved, "Market is not open for betting");

        _transfer(msg.sender, address(this), amount);

        if (side == Outcome.YES) {
            market.yesPool += amount;
        } else {
            market.noPool += amount;
        }
        market.totalVolume += amount;

        marketBets[marketId].push(BetRecord({ bettor: msg.sender, side: side, amount: amount, payout: 0 }));
        emit BetPlaced(marketId, msg.sender, side, amount);
    }

    function resolveMarket(string calldata marketId, Outcome outcome) external onlyOwner {
        require(outcome == Outcome.YES || outcome == Outcome.NO, "outcome must be YES or NO");

        Market storage market = markets[marketId];
        require(market.exists, "Market not found");
        require(!market.resolved, "Market is already resolved");

        market.resolved = true;
        market.outcome = outcome;

        BetRecord[] storage bets = marketBets[marketId];

        uint256 totalPool = market.totalVolume;
        uint256 winningPool = 0;
        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].side == outcome) {
                winningPool += bets[i].amount;
            }
        }

        uint256 distributed = 0;
        int256 lastWinnerIndex = -1;
        for (uint256 i = 0; i < bets.length; i++) {
            uint256 payout;
            if (winningPool == 0) {
                payout = bets[i].amount;
            } else if (bets[i].side == outcome) {
                payout = (bets[i].amount * totalPool) / winningPool;
                distributed += payout;
                lastWinnerIndex = int256(i);
            } else {
                payout = 0;
            }
            bets[i].payout = payout;
            if (payout > 0) {
                balanceOf[address(this)] -= payout;
                balanceOf[bets[i].bettor] += payout;
                emit Transfer(address(this), bets[i].bettor, payout);
            }
        }

        if (winningPool > 0 && lastWinnerIndex >= 0 && distributed < totalPool) {
            uint256 remainder = totalPool - distributed;
            address lastWinner = bets[uint256(lastWinnerIndex)].bettor;
            bets[uint256(lastWinnerIndex)].payout += remainder;
            balanceOf[address(this)] -= remainder;
            balanceOf[lastWinner] += remainder;
            emit Transfer(address(this), lastWinner, remainder);
        }

        emit MarketResolved(marketId, outcome, totalPool);
    }

    function getBetCount(string calldata marketId) external view returns (uint256) {
        return marketBets[marketId].length;
    }

    function getBet(
        string calldata marketId,
        uint256 index
    ) external view returns (address bettor, Outcome side, uint256 amount, uint256 payout) {
        BetRecord storage bet = marketBets[marketId][index];
        return (bet.bettor, bet.side, bet.amount, bet.payout);
    }
}
