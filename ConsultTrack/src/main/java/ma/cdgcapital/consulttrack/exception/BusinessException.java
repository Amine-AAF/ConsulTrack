package ma.cdgcapital.consulttrack.exception;

/**
 * Exception métier : erreurs prévisibles qui doivent retourner 400 au client.
 */
public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
}
