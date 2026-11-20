# Modelo de dados

PostgreSQL 17, esquema versionado por migrations do TypeORM (`AthonisBackend/src/database/migrations`). Toda tabela de negócio tem `id_company`: o isolamento entre empresas é feito pela API a partir do token.

```mermaid
erDiagram
  company ||--o{ user : "tem"
  company ||--o{ client : "tem"
  company ||--o{ driver : "tem"
  company ||--o{ vehicle : "tem"
  company ||--o{ order : "tem"
  company ||--o{ route : "tem"
  user |o--o| driver : "login do app"
  user ||--o{ refresh_token : "sessões"
  client ||--o{ order : "pede"
  driver ||--o{ route : "executa"
  vehicle ||--o{ route : "usado em"
  driver |o--o| vehicle : "padrão"
  optimized_route_history ||--o{ route : "gerou"
  route ||--o{ order : "paradas (stop_sequence)"
  route ||--o{ route_event : "eventos"
  route ||--o{ route_location_ping : "rastro GPS"
  route ||--o| route_execution_metrics : "consolidado"
  route ||--o{ route_returned_stop : "devolvidas ao cancelar"
  order ||--o{ route_event : "baixa / ocorrência"

  company {
    int id_company PK
    string corporate_name
    string document
    string depot_street
    decimal depot_latitude
    decimal depot_longitude
    decimal cost_per_km
    decimal cost_per_hour
    int stop_duration_minutes
    string operation_start_time
    string operation_end_time
  }
  user {
    int id PK
    int id_company FK
    string email
    string password "hash bcrypt"
    string role "admin | user | driver"
    int driver_id FK
  }
  refresh_token {
    int id PK
    int user_id FK
    string token_hash "SHA-256"
    timestamptz expires_at
    timestamptz revoked_at
  }
  client {
    int client_id PK
    int id_company FK
    string name
    string document "CPF/CNPJ, só dígitos"
    string type "F | J"
    string street
    decimal latitude
    decimal longitude
  }
  driver {
    int driver_id PK
    int id_company FK
    string name
    string cnh
    string cnh_category
    date cnh_expiration
    string status
  }
  vehicle {
    int vehicle_id PK
    int id_company FK
    string name
    string plate
    string type "van | truck | motorcycle | utility"
    int capacity_kg
  }
  order {
    int order_id PK
    int id_company FK
    int client_id FK
    int route_id FK
    int stop_sequence
    string status "pending ... delivered | failed"
    string urgency
    date delivery_date
    string delivery_window
    decimal delivery_latitude
    decimal delivery_longitude
  }
  route {
    int route_id PK
    int id_company FK
    int driver_id FK
    int vehicle_id FK
    int history_id FK
    string status "planned | active | completed | cancelled"
    date planned_date
    int total_distance_m
    int total_duration_min
    bool simulated
    timestamptz started_at
    timestamptz finished_at
  }
  route_event {
    int id PK
    int route_id FK
    int order_id FK
    string type "route_started | arrived | delivered | failed | route_finished | route_cancelled"
    string occurrence_type
    string notes
    decimal latitude
    timestamptz occurred_at "hora do aparelho"
    string client_event_id "único por empresa"
  }
  route_location_ping {
    int id PK
    int route_id FK
    decimal latitude
    decimal longitude
    float accuracy_m
    float speed_mps
    timestamptz recorded_at
    string client_ping_id "único por empresa"
  }
  route_execution_metrics {
    int id PK
    int route_id FK
    int planned_distance_m
    int actual_distance_m
    int planned_duration_min
    int actual_duration_min
    int stops_out_of_order
    float idle_time_min
    float avg_delay_min
    json stops "execução por parada"
  }
  route_returned_stop {
    int id PK
    int route_id FK
    int order_id FK
  }
  optimized_route_history {
    int id PK
    int id_company FK
    json optimization_result "ETA planejado por parada"
  }
```

## Banco local do aplicativo (SQLite)

| Tabela | Papel |
|---|---|
| `route` | Cópia das rotas do dia (JSON), para abrir sem rede |
| `outbox` | Ações a enviar, em ordem (`seq`): `id` = `client_event_id`, `kind`, `payload`, `status`, `attempts`, `next_attempt_at`, `last_error` |
| `ping` | Pontos de GPS ainda não enviados |
| `kv` | Valores avulsos (rota rastreada, dia da cópia, consentimento de localização) |

Os campos `client_event_id` / `client_ping_id` são UUIDs gerados no aparelho e têm índice único no servidor: reenviar não duplica (ver [[Fila Offline|Fila-Offline]]).
