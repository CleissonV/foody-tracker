package com.foody.tracker.shared.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import com.foody.tracker.orders.domain.InvalidStatusTransition;
import java.util.LinkedHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ProblemDetail application(ApiException exception, HttpServletRequest request) {
        return ProblemResponses.create(exception.status(), exception.code(), exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        var problem = ProblemResponses.create(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Confira os campos informados.", request.getRequestURI());
        var errors = new LinkedHashMap<String, String>();
        exception.getBindingResult().getFieldErrors().forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
        ConstraintViolationException.class, HandlerMethodValidationException.class, IllegalArgumentException.class})
    ProblemDetail invalidInput(Exception exception, HttpServletRequest request) {
        return ProblemResponses.create(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Requisição inválida. Confira os valores e os tipos dos campos.", request.getRequestURI());
    }

    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail authentication(AuthenticationException exception, HttpServletRequest request) {
        String message = exception instanceof AuthenticationCredentialsNotFoundException
            ? "Entre na sua conta para continuar." : "E-mail ou senha inválidos.";
        return ProblemResponses.create(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message, request.getRequestURI());
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ProblemDetail optimisticConflict(Exception exception, HttpServletRequest request) {
        return ProblemResponses.create(HttpStatus.CONFLICT, "ORDER_CONFLICT", "O pedido foi alterado em outra sessão. Atualize e tente novamente.", request.getRequestURI());
    }

    @ExceptionHandler(InvalidStatusTransition.class)
    ProblemDetail statusTransition(InvalidStatusTransition exception, HttpServletRequest request) {
        return ProblemResponses.create(HttpStatus.CONFLICT, "INVALID_STATUS_TRANSITION", exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail integrity(Exception exception, HttpServletRequest request) {
        return ProblemResponses.create(HttpStatus.CONFLICT, "DATA_CONFLICT", "Os dados informados conflitam com um registro existente.", request.getRequestURI());
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception exception, HttpServletRequest request) {
        log.error("Unexpected error on {} {}", request.getMethod(), request.getRequestURI(), exception);
        return ProblemResponses.create(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Não foi possível concluir a operação.", request.getRequestURI());
    }
}
