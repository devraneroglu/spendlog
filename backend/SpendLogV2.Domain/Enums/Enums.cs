namespace SpendLogV2.Domain.Enums;

public enum AccountType
{
    Cash = 1,
    Bank = 2,
    CreditCard = 3,
    Investment = 4,
    Crypto = 5,
    Other = 6
}

public enum TransactionType
{
    Income = 1,
    Expense = 2
}

public enum CategoryType
{
    Expense = 1,
    Income = 2,
    Both = 3
}

public enum Currency
{
    TRY = 1,
    USD = 2,
    EUR = 3,
    GBP = 4,
    BTC = 5,
    ETH = 6
}

public enum AssetType
{
    Stock = 1,      // BIST & US Stocks
    Crypto = 2,     // Bitcoin, Altcoins
    Commodity = 3,  // Gram Altın, Çeyrek, Ons
    ETF = 4,        // Fonlar
    Bond = 5        // Tahvil / Bono
}

public enum PaymentPlanType
{
    Expense = 1,
    Income = 2
}

public enum TrackerType
{
    Counter = 1,
    Note = 2,
    Custom = 3
}

public enum TelegramActionType
{
    QueryBalance = 1,
    AddExpense = 2,
    AddIncome = 3,
    Transfer = 4
}
