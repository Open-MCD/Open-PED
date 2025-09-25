// PED Status modeled after C# PedStatus fields used across commands

class PedStatus {
    constructor() {
        // Session and device flags
        this.SessionOpen = false;
        this.DeviceBusy = false;
        this.ApprovalMode = true; // default in C# after reboot
        this.PartialPayment = false;
        this.DuplicateSwipe = false;
        this.PayWithArchCard = false;
        this.UpdateAvailable = false;
        this.UpdateStatus = 0; // 0..6
        this.UserCancel = false;
        this.CardSwiped = false;
        this.Connected = false;
        this.LastCommand = '';
        this.Counter = 0;

        // Active card minimal fields
        this.ActiveCard = {
            Number: '4111111111111111',
            Type: 'VISA',
            MonthExpire: 1,
            YearExpire: 2030
        };
    }
}

module.exports = PedStatus;

module.exports = PedStatus;
