# AgentNet — Makefile
# Ishlatish: make setup | make dev | make stop

.PHONY: setup dev stop clean db seed

## Birinchi marta sozlash
setup:
	@echo "==> 1. .env fayl sozlanmoqda..."
	@if not exist .env (copy .env.example .env && echo ".env yaratildi! Endi kalit qiymatlarni kiriting.") else (echo ".env allaqachon mavjud")
	@echo "==> 2. Node paketlar o'rnatilmoqda..."
	npm install
	@echo "==> 3. Python muhit (apps/agent-engine)..."
	cd apps/agent-engine && python -m venv .venv
	cd apps/agent-engine && .venv/Scripts/pip install -r requirements.txt
	@echo "==> 4. Prisma client generatsiyasi..."
	cd apps/api && npx prisma generate
	@echo ""
	@echo "✅ Setup tugadi!"
	@echo "Keyin: make infra (Docker), keyin make db-migrate, keyin make dev"

## Infra (Postgres + Redis)
infra:
	docker compose up -d
	@echo "✅ Postgres + Redis ishga tushdi"

## DB migratsiya
db-migrate:
	cd apps/api && npx prisma migrate dev --name init

## Barcha servislarni ishga tushirish
dev:
	@echo "Barcha servislar ishga tushirilmoqda..."
	npm run dev

## Faqat FastAPI
engine:
	cd apps/agent-engine && .venv/Scripts/uvicorn main:app --reload --port 8000

## To'xtatish
stop:
	docker compose down

## Tozalash
clean:
	docker compose down -v
	@echo "Volume lar o'chirildi"
