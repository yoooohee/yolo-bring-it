# 🎮 YOLO-Bring-It (MSA)
안녕하세요! 저희 YOLO-Bring-It은 친구들과 언제 어디서나 즐길 수 있는 실시간 미니게임 플랫폼입니다.
단순히 게임을 하는 것이 아니라, 영상으로 함께 웃고 채팅으로 소통하며 AI 판정으로 공정하게 경쟁하는 새로운 형태의 놀이 공간을 제공합니다.

특히 게임을 하면서 얻는 점수와 업적은 랭킹과 아이템으로 이어져 지속적인 참여를 유도하고,
개인화된 캐릭터와 커스터마이징을 통해 자신만의 개성을 표현할 수 있습니다.

우리 서비스는 짧고 가볍게 즐길 수 있는 소셜 엔터테인먼트에 집중했습니다.
모바일과 웹에서 쉽게 접근 가능하고 친구 초대만으로 바로 플레이할 수 있어 Z세대가 원하는 **“빠른 몰입과 공유”** 경험을 제공합니다.

한마디로, **YOLO-Bring-It은 실시간성과 재미, 그리고 소셜 연결을 결합한 차세대 소셜 게임 플랫폼**입니다! 🚀

![screenshot](/docs/screenshot.png)

## 🌐 아키텍처 개요
- **Frontend**: React + TypeScript + Vite + Tailwind + Zustand + Three.js
- **Backend** (Spring Boot MSA)
    - gateway-service 🌐 : API Gateway
    - discovery-service 🔍 : 서비스 디스커버리 (Eureka)
    - config-service ⚙️ : 중앙 설정 관리 (Git 연동)
    - user-service 👤 : 회원/인증/아이템/업적
    - game-service 🕹️ : 게임 진행/점수/랭킹
    - chat-service 💬 : 실시간 채팅(WebSocket, STOMP)
    - ai-service 🤖 : AI 판정(gRPC)
- **Infra & Data**
    - PostgreSQL 🗄️ (유저/게임/채팅 DB)
    - Redis ⚡ (세션, 캐시, 토큰 블랙리스트)
    - RabbitMQ 📨 (채팅/알림 pub-sub)
    - Kafka 📊 (게임/유저 이벤트 스트리밍)
    - Zipkin 🔎 (분산 트레이싱), OpenSearch 🔍 (로그/검색)
    - LiveKit 🎥 (화상 기반 게임룸)
    - AWS S3 ☁️ (파일 저장), Email 📧 (알림/인증)

## 📂 프로젝트 구조
```
YOLO-Bring-It/
├── frontend/                      # React + TS + Vite
│   ├── src/...
│   └── package.json
│
├── backend/
│   ├── gateway-service/           # 🌐 Gateway (Spring Cloud Gateway)
│   ├── discovery-service/         # 🔍 Eureka
│   ├── config-service/            # ⚙️ Config (Git 연동)
│   ├── user-service/              # 👤 User (Auth, Profile, Items)
│   ├── game-service/              # 🕹️ Game (Round, Score, Ranking)
│   ├── chat-service/              # 💬 Chat (WebSocket, RabbitMQ)
│   └── ai-service/                # 🤖 gRPC AI 판정
│
└── infra/
    ├── docker-compose.yml         # Postgres, Redis, RabbitMQ, Kafka 등
    └── nginx.conf                 # Reverse Proxy

```

## 🔑 주요 기능
- 🕹️ AI 기반 미니게임: YOLO, DeepFace, CLIP 등 활용
- 💬 실시간 채팅: WebSocket + STOMP + RabbitMQ
- 🎥 화상게임: LiveKit 기반 WebRTC
- 📊 랭킹 시스템: Kafka 이벤트 스트리밍
- ⚡ MSA 아키텍처: Spring Cloud (Gateway, Eureka, Config)
- ☁️ 클라우드 인프라: AWS EC2 + S3 + Nginx

## 🏗️ 아키텍처
![screenshot](/docs/architecture.png)

## 🔗 ER-Diagram
![screenshot](/docs/erd.png)