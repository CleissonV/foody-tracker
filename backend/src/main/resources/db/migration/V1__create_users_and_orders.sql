CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    CONSTRAINT uk_app_users_email UNIQUE (email)
);

CREATE TABLE delivery_orders (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    street VARCHAR(150) NOT NULL,
    street_number VARCHAR(20) NOT NULL,
    complement VARCHAR(100),
    neighborhood VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    postal_code VARCHAR(9) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT fk_orders_owner FOREIGN KEY (owner_id) REFERENCES app_users(id),
    CONSTRAINT ck_order_status CHECK (status IN ('RECEBIDO','EM_PREPARO','SAIU_PARA_ENTREGA','ENTREGUE','CANCELADO'))
);
CREATE INDEX idx_orders_owner_created ON delivery_orders(owner_id, created_at DESC, id DESC);
CREATE INDEX idx_orders_owner_status ON delivery_orders(owner_id, status);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES delivery_orders(id),
    CONSTRAINT ck_item_quantity CHECK (quantity BETWEEN 1 AND 999),
    CONSTRAINT ck_item_price CHECK (unit_price >= 0)
);
CREATE INDEX idx_items_order ON order_items(order_id);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    changed_by UUID NOT NULL,
    sequence_number INTEGER NOT NULL,
    CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES delivery_orders(id),
    CONSTRAINT fk_history_actor FOREIGN KEY (changed_by) REFERENCES app_users(id),
    CONSTRAINT uk_history_sequence UNIQUE (order_id, sequence_number)
);
CREATE INDEX idx_history_order ON order_status_history(order_id, changed_at);
