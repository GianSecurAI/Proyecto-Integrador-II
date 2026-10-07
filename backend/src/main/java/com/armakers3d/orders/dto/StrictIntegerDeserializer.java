package com.armakers3d.orders.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;

/**
 * Accepts only a JSON integer token that fits an int. Jackson would otherwise silently coerce 2.5 to 2
 * and "2" to 2, so a quantity of 2.5 would be accepted as 2. Anything else fails with a
 * deserialization error, which the global handler renders as 400 MALFORMED_REQUEST.
 */
public class StrictIntegerDeserializer extends JsonDeserializer<Integer> {

    @Override
    public Integer deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        if (p.currentToken() != JsonToken.VALUE_NUMBER_INT) {
            return (Integer) ctxt.handleUnexpectedToken(Integer.class, p);
        }
        try {
            return p.getIntValue();
        } catch (com.fasterxml.jackson.core.exc.InputCoercionException e) {
            return (Integer) ctxt.handleWeirdNumberValue(Integer.class, p.getNumberValue(), "not an int");
        }
    }
}
