package com.armakers3d.shared.error;

import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Centralized exception handling producing the single JSON error envelope (Constitution
 * Principle IX). No controller in this codebase should ever catch and translate an exception
 * itself (Prohibited Practices #4 spirit extended to error handling) — every rejection reason is
 * a typed exception handled once, here.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex) {
        if (ex instanceof HasFieldErrors withDetails) {
            return ResponseEntity.status(ex.getStatus())
                    .body(ApiError.of(ex.getErrorCode(), ex.getMessage(), withDetails.getFieldErrors()));
        }
        return ResponseEntity.status(ex.getStatus()).body(ApiError.of(ex.getErrorCode(), ex.getMessage()));
    }

    /**
     * Method security ({@code @PreAuthorize}) denials surface inside the controller layer, i.e. before
     * Spring Security's filter-level handlers could see them, so they are mapped here to the same
     * envelope the {@code AccessDeniedHandler} produces for URL-rule denials.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiError.of("FORBIDDEN", "This capability is not available for your role."));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.of("UNAUTHENTICATED", "Authentication is required to access this resource."));
    }

    /** Constraint annotations directly on controller parameters (e.g. {@code @Min} on a query param). */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiError> handleMethodValidation(HandlerMethodValidationException ex) {
        List<ApiError.FieldError> fieldErrors =
                ex.getParameterValidationResults().stream()
                        .flatMap(r -> r.getResolvableErrors().stream()
                                .map(e -> new ApiError.FieldError(
                                        r.getMethodParameter().getParameterName(), e.getDefaultMessage())))
                        .toList();
        return validationFailed(fieldErrors);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        List<ApiError.FieldError> fieldErrors =
                ex.getBindingResult().getFieldErrors().stream()
                        .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
                        .toList();
        return validationFailed(fieldErrors);
    }

    private static ResponseEntity<ApiError> validationFailed(List<ApiError.FieldError> fieldErrors) {
        String message =
                fieldErrors.isEmpty()
                        ? "Validation failed."
                        : fieldErrors.get(0).field() + ": " + fieldErrors.get(0).message();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiError.of("VALIDATION_FAILED", message, fieldErrors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex) {
        List<ApiError.FieldError> fieldErrors =
                ex.getConstraintViolations().stream()
                        .map(v -> new ApiError.FieldError(v.getPropertyPath().toString(), v.getMessage()))
                        .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiError.of("VALIDATION_FAILED", "Validation failed.", fieldErrors));
    }

    /** Missing/invalid request header (e.g. a malformed binding), previously an unexplained 500. */
    @ExceptionHandler(ServletRequestBindingException.class)
    public ResponseEntity<ApiError> handleBinding(ServletRequestBindingException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiError.of("MALFORMED_REQUEST", "A request header or parameter is missing or invalid."));
    }

    /** {@code Accept} the API cannot satisfy (it only produces JSON): 406, not a 500. */
    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<ApiError> handleNotAcceptable(HttpMediaTypeNotAcceptableException ex) {
        return ResponseEntity.status(HttpStatus.NOT_ACCEPTABLE)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(ApiError.of("NOT_ACCEPTABLE", "Only application/json is produced."));
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> handleBadParameter(Exception ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiError.of("MALFORMED_REQUEST", "A request parameter is missing or invalid."));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> handleUnsupportedMediaType(HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiError.of("UNSUPPORTED_MEDIA_TYPE", "Content type not supported."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of("NOT_FOUND", "Resource not found."));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiError.of("MALFORMED_REQUEST", "The request body could not be read."));
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NoHandlerFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of("NOT_FOUND", "Resource not found."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiError.of("METHOD_NOT_ALLOWED", "HTTP method not supported for this resource."));
    }

    /**
     * Last-resort catch-all. Never leaks the exception message, stack trace, or class name to
     * the client (Principle IX) — the detail is logged server-side only.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Unexpected error handling request", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("INTERNAL_ERROR", "An unexpected error occurred."));
    }
}
