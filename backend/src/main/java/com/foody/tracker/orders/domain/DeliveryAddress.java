package com.foody.tracker.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class DeliveryAddress {
    @Column(nullable = false, length = 150)
    private String street;
    @Column(name = "street_number", nullable = false, length = 20)
    private String number;
    @Column(length = 100)
    private String complement;
    @Column(nullable = false, length = 100)
    private String neighborhood;
    @Column(nullable = false, length = 100)
    private String city;
    @Column(nullable = false, length = 2)
    private String state;
    @Column(name = "postal_code", nullable = false, length = 9)
    private String postalCode;

    protected DeliveryAddress() {}

    public DeliveryAddress(String street, String number, String complement, String neighborhood,
                           String city, String state, String postalCode) {
        this.street = street.strip();
        this.number = number.strip();
        this.complement = complement == null ? null : complement.strip();
        this.neighborhood = neighborhood.strip();
        this.city = city.strip();
        this.state = state;
        this.postalCode = postalCode;
    }

    public String getStreet() { return street; }
    public String getNumber() { return number; }
    public String getComplement() { return complement; }
    public String getNeighborhood() { return neighborhood; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getPostalCode() { return postalCode; }
}
