-- Cloudflare D1 Database Schema for V-MARKET
-- File: database/schema.sql

-- 1. Users Table (Discord OAuth synced)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,               -- Discord User ID (snowflake)
    username TEXT NOT NULL,           -- Discord Username
    discriminator TEXT,               -- Discord Tag or modern username
    avatar_url TEXT,                  -- Discord Avatar URL
    points INTEGER DEFAULT 0,         -- Cash/Point balance in KRW
    role TEXT DEFAULT 'user',         -- 'user' or 'admin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table (VALORANT Account Tiers)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,              -- e.g. "스킨 0~10"
    description TEXT NOT NULL,        -- e.g. "스킨 0~10개짜리 계정"
    skins TEXT NOT NULL,              -- Details regarding skins
    price INTEGER NOT NULL,           -- Price in KRW (e.g. 10, 50, 100, 300)
    stock INTEGER NOT NULL DEFAULT 0, -- Available inventory
    server TEXT DEFAULT '한국 (KR)',
    details TEXT,
    status TEXT DEFAULT 'active',     -- 'active', 'soldout', 'hidden'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inventory Stock Accounts (Pre-stocked login credentials)
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    credentials TEXT NOT NULL,        -- Format: "username:password" or encoded
    is_sold INTEGER DEFAULT 0,        -- 0 = available, 1 = issued
    order_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 4. Deposit Requests (Cash Point Top-up)
CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    amount INTEGER NOT NULL,          -- Requested point charge
    depositor_name TEXT NOT NULL,     -- Actual Korean bank sender name
    bank_name TEXT NOT NULL,          -- '토스뱅크', '카카오뱅크' etc.
    status TEXT DEFAULT 'pending',     -- 'pending', 'approved', 'rejected'
    processed_by TEXT,                -- Admin ID who approved/rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5. Orders & Purchases Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL, -- e.g. ORD-20260910-001
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_title TEXT NOT NULL,
    price INTEGER NOT NULL,
    account_data TEXT NOT NULL,        -- Credentials handed over to user
    status TEXT DEFAULT 'completed',   -- 'completed', 'refunded'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 6. Support Inquiries Table
CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reply TEXT,
    status TEXT DEFAULT 'open',        -- 'open', 'answered', 'closed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Seed initial products specified in the brief
INSERT OR IGNORE INTO products (id, title, description, skins, price, stock, server, details) VALUES
(1, '스킨 0~10', '스킨 0~10개짜리 계정', '0~10개 무작위', 10, 62, '한국 (KR)', '기본 지급 스킨 및 배틀패스 스킨 무작위 포함. 계정 생성일 90일 이상, 본인 확인 완료 안전 계정입니다.'),
(2, '스킨 11~20', '스킨 11~20개짜리 계정', '11~20개 무작위', 50, 45, '한국 (KR)', '인기 총기 스킨 2종 이상 확정 포함. 경쟁전 배치 즉시 플레이 가능, 이메일 변경 가능.'),
(3, '스킨 21~30', '스킨 21~30개짜리 계정', '21~30개 무작위', 100, 28, '한국 (KR)', '프라임, 밴달, 팬텀 등 고급 무기 스킨 다수 보유. 칼 스킨 1개 이상 확정 포함.'),
(4, '스킨 31~40', '스킨 31~40개짜리 계정', '31~40개 무작위', 300, 14, '한국 (KR)', '한정판 번들 및 칼/근접무기 복수 보유. 챔피언스/쿠로나미/오니 계열 확률 높은 프리미엄 계정.');
