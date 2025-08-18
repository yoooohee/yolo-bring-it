# Yolo-bring-it-ai

[![GitHub stars](https://img.shields.io/github/stars/[사용자명]/Yolo-bring-it-ai)](https://github.com/[사용자명]/Yolo-bring-it-ai/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/[사용자명]/Yolo-bring-it-ai)](https://github.com/[사용자명]/Yolo-bring-it-ai/network)
[![License](https://img.shields.io/github/license/[사용자명]/Yolo-bring-it-ai)](https://github.com/[사용자명]/Yolo-bring-it-ai/blob/main/LICENSE)

## 프로젝트 소개
`Yolo-bring-it-ai`는 파이썬을 이용한 RESTAPI 를 통해 정보를 받는 곳입니다. 

리액트 페이지를 통해서 테스트 및 홈페이지에서 기능을 테스트 할 수 있습니다.

### 특징
- [기능 1: 고성능 YOLOv8 모델 기반 객체 탐지]
- [기능 2: DeepFace를 이용한 얼굴 감정 인식]
- [기능 3: CLIP를 이용한 이미지-텍스트 유사도 검사]
- [기능 4: MediaPipe Face Mesh 를 이용한 실시간 눈 감기 감지]

## 시작하기

### 필수 요구사항
- 가상 환경에서 실행 요망.(파이썬 3.10 추천)

### 개발자 용 참고


pip freeze > requirements.txt -> 설치환경을 가져옴


### 설치
1. 레포지토리 클론:
   ```bash
   git clone https://github.com/[사용자명]/Yolo-bring-it-ai.git
   cd Yolo-bring-it-ai
   ```
2. 가상 환경 설정 (권장):
   ```bash
   conda create -n yolo_env python=3.10
   ```
3. 종속성 설치:
   ```bash
   pip install -r requirements.txt
   ```

### 실행
기본적으로 다음 명령어로 실행할 수 있습니다:

가상환경 fastapi 폴더에 들어가서
```
uvicorn main:app --host localhost --reload
```
를 하면 백엔드 서버가 켜짐

그리고 cmd에서 yolo-client를 가서
```
npm start
```
를 하면 React기반 테스트할 수 있는 페이지가 열림.


### 실행2

Docker화 작업이 완료 되었습니다.

전과 달라진 점

1. requirements.txt 에서 버전 충돌이 많았어서, 제대로 충돌 안나게 다시 설정하고 Docker에 맞게 설정 후 만들었습니다.

어떻게 사용하나요?

- docker build -t my-fastapi-app2 .

이렇게 하면 my-fastapi-app2 라는 docker 이미지 파일을 하나 만듭니다. 이름은 자유롭게 설정하셔도 됩니다 (시간 한 20분 걸림)

만들어지면

- docker run -p 8000:8000 my-fastapi-app2

이렇게 실행합니다. 도커 프로그램에서 해도 되는데, 이렇게 하는걸 추천합니다.

만약 이렇게 까지 했는데 안된다면?

그 도커 컨테이너 들어가서 Exec 로 간다음

- python -c "from yolo_api import app"

이걸 한번 해주세요. 그럼 잘 될겁니다

