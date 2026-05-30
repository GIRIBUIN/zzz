# RPI to AWS IoT Ingest Plan

## Goal

RPI에서 DHT11, MQ5 센서 데이터를 수집한 뒤 AWS로 전송하고, 기존 `zzz-iot-ingest`
Lambda가 RDS `sensor_raw` 테이블에 저장하도록 연결한다.

현재 최신 브랜치(`origin/aws-lambda`)에는 수신부인
`lambda/zzz-iot-ingest/index.js`가 이미 있다. 부족한 부분은 RPI에서 AWS IoT Core로
publish하는 송신부다.

## Target Flow

```text
RPI sensors
-> AWS IoT Core MQTT topic
-> IoT Rule
-> lambda/zzz-iot-ingest
-> RDS MySQL sensor_raw
-> prediction/result handlers
```

## Implemented Run Command

RPI에서 1분 단위로 센서를 수집해 AWS IoT Core로 송신한다.

```bash
node rpi/sensors/collect_sensors.js --watch --send --user-id 1 --device-id 1
```

수집/송신 주기는 `.env`의 아래 값으로 조절한다.

```env
SENSOR_INTERVAL_SECONDS=60
```

보고서 기준 기본값은 60초이며, 30초/300초 등으로 바꾸려면 이 값만 수정하면 된다.

## Payload Shape

`lambda/zzz-iot-ingest/index.js`가 event 최상위 필드를 읽으므로 RPI는 아래 형태로
publish해야 한다.

```json
{
  "user_id": 1,
  "device_id": 1,
  "timestamp": "2026-05-30T22:30:00",
  "temperature": 24.8,
  "humidity": 52.1,
  "mq5_raw": 317,
  "mq5_index": 0.62
}
```

## Added Files

### `rpi/aws/iot_publisher.js`

AWS IoT Core MQTT 연결과 publish를 담당한다.

필요한 역할:
- `.env`에서 IoT endpoint, certificate, private key, CA, topic을 읽는다.
- sensor payload를 JSON으로 publish한다.
- publish 실패 시 호출자가 retry/buffer 처리할 수 있도록 error를 throw한다.

현재 `aws-iot-device-sdk-v2`를 사용해 mTLS MQTT publish를 수행한다.

### `rpi/buffer/local_buffer.js`

전송 실패 데이터를 로컬 파일에 저장하고 재전송하는 큐 역할을 맡는다.

필요한 역할:
- `enqueue(payload)`: publish 실패 시 payload 저장
- `flush(publishFn)`: 네트워크 복구 후 저장된 payload 재전송
- buffer 파일 위치는 `storage/raw/sensor_raw/rpi_failed_publish.jsonl` 권장

현재 이 파일은 비어 있으므로 여기에 구현하는 것이 자연스럽다.

### `rpi/sensors/collect_sensors.js`

기존 센서 수집 진입점에 AWS 전송 옵션을 붙인다.

필요한 변경:
- `--send` 옵션 추가
- `--save`는 로컬 DB 저장, `--send`는 AWS IoT publish로 역할 분리
- `--watch --send` 실행 시 주기적으로 수집 후 publish
- 전송 실패 시 `rpi/buffer/local_buffer.js`에 저장

예상 실행 예:

```bash
node rpi/sensors/collect_sensors.js --watch --send --user-id 1 --device-id 1
```

## Updated Files

### `.env.example`

RPI 송신에 필요한 환경변수를 추가한다.

```env
RPI_USER_ID=1
RPI_DEVICE_ID=1
AWS_IOT_ENDPOINT=xxxxxxxxxxxxx-ats.iot.ap-northeast-2.amazonaws.com
AWS_IOT_CLIENT_ID=zzz-rpi-001
AWS_IOT_SENSOR_TOPIC=zzz/rpi/sensor
AWS_IOT_CERT_PATH=./certs/device.pem.crt
AWS_IOT_KEY_PATH=./certs/private.pem.key
AWS_IOT_CA_PATH=./certs/AmazonRootCA1.pem
```

### `package.json`

RPI에서 MQTT over mTLS로 AWS IoT Core에 연결할 SDK dependency를 추가한다.

권장:

```bash
npm install aws-iot-device-sdk-v2
```

### `HOW_TO_RUN.md` or `rpi/README.md`

RPI 실행 방법을 추가한다.

```bash
node rpi/sensors/collect_sensors.js --watch --send --user-id 1 --device-id 1
```

## AWS Side Needed Configuration

코드 위치는 아니지만 반드시 필요한 AWS 설정이다.

1. AWS IoT Thing 생성
2. Device certificate/private key 발급
3. IoT policy에 publish 권한 부여
4. IoT Rule 생성

권장 rule:

```sql
SELECT * FROM 'zzz/rpi/sensor'
```

Rule action:

```text
Invoke Lambda: zzz-iot-ingest
```

## Existing Receiver

이미 존재하는 수신 코드:

```text
lambda/zzz-iot-ingest/index.js
```

이 Lambda는 event에서 아래 값을 읽고 `sensor_raw`에 저장한다.

- `user_id`
- `device_id`
- `timestamp` 또는 `ts`
- `temperature`
- `humidity`
- `mq5_raw`
- `mq5_index`

따라서 RPI 송신부는 이 payload shape만 맞추면 된다.
