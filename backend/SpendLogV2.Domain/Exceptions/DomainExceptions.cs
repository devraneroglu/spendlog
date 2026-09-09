namespace SpendLogV2.Domain.Exceptions;

public abstract class BaseCustomException : Exception
{
    public int StatusCode { get; }
    public string Title { get; }

    protected BaseCustomException(string message, string title = "İşlem Hatası", int statusCode = 400) : base(message)
    {
        Title = title;
        StatusCode = statusCode;
    }
}

public class DomainException : BaseCustomException
{
    public DomainException(string message, string title = "Doğrulama / İş Mantığı Hatası") 
        : base(message, title, 400)
    {
    }
}

public class NotFoundException : BaseCustomException
{
    public NotFoundException(string entityName, object key) 
        : base($"{entityName} ({key}) bulunamadı.", "Kayıt Bulunamadı", 404)
    {
    }
}

public class ValidationException : BaseCustomException
{
    public IDictionary<string, string[]> Errors { get; }

    public ValidationException(IDictionary<string, string[]> errors) 
        : base("Bir veya daha fazla doğrulama hatası oluştu.", "Doğrulama Hatası", 422)
    {
        Errors = errors;
    }

    public ValidationException(string propertyName, string errorMessage) 
        : base("Doğrulama hatası oluştu.", "Doğrulama Hatası", 422)
    {
        Errors = new Dictionary<string, string[]>
        {
            { propertyName, new[] { errorMessage } }
        };
    }
}
