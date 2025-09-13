// Credit Card logic placeholder


class CreditCard {
    constructor() {
        this.number = '4111111111111111';
        this.expiry = '12/30';
        this.holder = 'JOHN DOE';
    }

    getInfo() {
        return {
            CardType: 'Credit',
            Number: this.number,
            Expiry: this.expiry,
            Holder: this.holder
        };
    }
}

module.exports = CreditCard;
