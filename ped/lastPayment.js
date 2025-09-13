// Last Payment logic placeholder


class LastPayment {
    constructor() {
        this.amount = 42.50;
        this.date = '2025-09-13';
        this.method = 'CreditCard';
    }

    getInfo() {
        return {
            Amount: this.amount,
            Date: this.date,
            Method: this.method
        };
    }
}

module.exports = LastPayment;
