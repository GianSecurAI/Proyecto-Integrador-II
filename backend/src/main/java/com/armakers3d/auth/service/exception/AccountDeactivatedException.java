package com.armakers3d.auth.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/**
 * spec.md Edge Cases: "What happens to an in-progress, unexpired code when its owning account is
 * later found to be deactivated or otherwise blocked by an administrator? Verification must be
 * denied even if the code itself is otherwise valid." Not assigned an explicit status code by
 * contracts/otp-auth-api.md (that document predates this edge case being enumerated in detail);
 * 403 is chosen here as the closest standard-HTTP-semantics fit ("valid credential, but the
 * subject is not permitted"), documented here since it is a genuine, deliberate gap-filling
 * decision rather than an accidental default (Constitution Principle XX).
 */
public class AccountDeactivatedException extends ApiException {

    public AccountDeactivatedException() {
        super(HttpStatus.FORBIDDEN, "ACCOUNT_DEACTIVATED", "This account is not available.");
    }
}
