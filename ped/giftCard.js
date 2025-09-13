// Gift Card logic placeholder


class GiftCard {
    constructor() {
        this.number = '9999888877776666';
        this.balance = 100.00;
    }

    getInfo() {
        return {
            CardType: 'Gift',
            Number: this.number,
            Balance: this.balance
        };
    }
}

module.exports = GiftCard;
