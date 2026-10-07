package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.orders.domain.PersonalizedOrderRules;
import com.armakers3d.shared.error.ValidationFailedException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class PersonalizedOrderRulesTest {

    private static PersonalizedOrderRules.Validated ok(String desc) {
        return PersonalizedOrderRules.validate("Ana@Example.test ", desc, new BigDecimal("10"), true);
    }

    @Test
    void normalizesEmailAndAmountScale() {
        var v = ok("  Llavero  ");
        assertThat(v.customerEmail()).isEqualTo("ana@example.test");
        assertThat(v.description()).isEqualTo("Llavero");
        assertThat(v.agreedAmount().toPlainString()).isEqualTo("10.00");
    }

    @Test
    void acceptsTrailingZerosBeyondTwoDecimalsAndMaxAmount() {
        assertThat(PersonalizedOrderRules.validate("a@b.co", "x", new BigDecimal("1.500"), true).agreedAmount())
                .isEqualByComparingTo("1.50");
        assertThat(PersonalizedOrderRules.validate("a@b.co", "x", new BigDecimal("999999.99"), true)).isNotNull();
    }

    @Test
    void rejectsCardLikeNumbersButAllowsShortNumbers() {
        assertThatThrownBy(() -> ok("tarjeta 4111-1111-1111-1111")).isInstanceOf(ValidationFailedException.class);
        assertThatThrownBy(() -> ok("cuenta 12345678901234567")).isInstanceOf(ValidationFailedException.class);
        assertThat(ok("Pedido 2024 de 25 piezas, tel 987654321")).isNotNull();
    }

    @Test
    void collectsEveryFailure() {
        assertThatThrownBy(() -> PersonalizedOrderRules.validate(null, null, null, null))
                .isInstanceOfSatisfying(ValidationFailedException.class,
                        e -> assertThat(e.getFieldErrors()).extracting(f -> f.field())
                                .containsExactly("customerEmail", "description", "agreedAmount", "paymentConfirmed"));
    }

    @Test
    void fingerprintDependsOnContentOnly() {
        assertThat(ok("a").fingerprint()).isEqualTo(ok("a").fingerprint()).isNotEqualTo(ok("b").fingerprint());
    }
}
