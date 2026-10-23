# Transaction Categoriser

API that accepts banking transactions and categorises them into 10 predefined categories using an LLM.

## Setup
```
cp .env.example .env   # set ANTHROPIC_API_KEY
docker compose up --build
```

## Development
```
npm install
npm test
```

## Docs
- [API](docs/api.md)
- [Design and trade-offs](docs/design.md)
- [Prompts](prompts/)
