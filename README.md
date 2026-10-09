# 🖨️ Ar Makers 3D

Aplicación web académica para gestionar los procesos comerciales de un negocio de impresión 3D (Perú): catálogo, carrito, checkout, pedidos personalizados vía asesor, seguimiento y administración.

> **Proyecto Integrador II** — Universidad Tecnológica del Perú (UTP) / Ingeniería de Sistemas e Informática

---

## ✨ Características

### 🛒 Compra de productos de catálogo (autoservicio)
- Catálogo con fotos, carrito y checkout.
- Pago manual por **Yape/Plin** con carga de comprobante y verificación por administración.
- El pedido se crea automáticamente al completar el checkout.
- Seguimiento del pedido y notificaciones por correo en los cambios de estado relevantes.

### 💬 Pedidos personalizados (mediados por asesor)
- El cliente es redirigido a WhatsApp desde la sección de llamada a la acción del *Home*.
- El asesor cotiza y cobra fuera del sistema, y luego registra el pedido con su cuenta de asesor.
- El cliente hace seguimiento igual que en un pedido de catálogo.

### ⚙️ Transversal
- **Autenticación sin contraseña** mediante OTP por correo (expiración, uso único, límite de intentos y rate limiting).
- **Autorización por roles:** Visitante, Cliente, Asesor y Administrador.
- Gestión de incidencias, reportes y administración de productos/usuarios.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Frontend** | Angular 20 (standalone components), TypeScript |
| **Backend** | Java 21, Spring Boot 3.5 (monolito modular), Spring Security, Spring Data JPA |
| **Base de datos**| PostgreSQL (gestionada en la nube), migraciones con Flyway |
| **API** | REST + JSON, documentación con OpenAPI/Swagger (springdoc) |
| **Correo** | Spring Mail |
| **Calidad** | JUnit / Spring Boot Test, H2 para pruebas, Spotless |
| **Despliegue** | Frontend en Vercel · Backend/BD en la nube `<completar>` |

---


## 🏗️ Arquitectura

```text
Angular SPA ──REST/JSON──▶️ Spring Boot (modular monolith) ──▶️ PostgreSQL

.
├── backend/     # API Spring Boot (com.armakers3d: auth, users, catalog, orders,
│                #                  payments, incidents, notifications, reports, shared)
├── frontend/    # SPA Angular (core / shared / features / layout)
├── docs/        # Requisitos, arquitectura, decisiones, diseño, revisiones
├── specs/       # Especificaciones de Spec Kit por feature
└── reference/   # PrintCrate (solo lectura, referencia conceptual)
```

---

### 📋 Requisitos Previos
Java 21 y Maven (o el wrapper incluido)

Node.js 20+ y npm

PostgreSQL (o usar el perfil nodb, ver abajo)

### 🚀 Puesta en Marcha
#### 1. Clonar el repositorio

```text
git clone <url-del-repositorio>
cd Proyecto-Integrador-II
```

#### 2. Backend

Configura las variables de entorno (nunca se versionan secretos):

| Variable | Descripción |
|---|---|
| <DB_URL> | URL JDBC de PostgreSQL |
| <DB_USER> / <DB_PASSWORD> | Credenciales de la BD |
| <MAIL_HOST>, <MAIL_USER>, <MAIL_PASSWORD> | SMTP para OTP y notificaciones |
| <JWT_SECRET> | Secreto de firma de sesión |

Ejecuta el servidor:

```text
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=local   # con PostgreSQL
mvn spring-boot:run -Dspring-boot.run.profiles=nodb    # sin base de datos (en memoria)
```

- API: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui.html

#### 3. Frontend

```text
cd frontend
npm install
npm start
```

Disponible en http://localhost:4200 (el proxy.conf.json redirige /api al backend).

--- 

## 🧪 Pruebas y Formateo

```text
# Ejecutar pruebas del Backend
cd backend && mvn test

# Ejecutar pruebas del Frontend
cd frontend && npm test
```

Para aplicar el formato de código en el backend: mvn spotless:apply

--- 

## 👥 Roles del Sistema

| Rol | Capacidades principales |
|---|---|
| Visitante | Ver catálogo y Home |
| Cliente | Carrito, checkout, seguimiento de pedidos |
| Asesor | Registrar pedidos personalizados tras confirmar el pago |
| Administrador | Productos, verificación de pagos, usuarios, reportes |

--- 

## 📘 Metodología

Desarrollo guiado por especificaciones con *Spec Kit*
(constitution → clarify → specify → plan → tasks → analyze → implement).
Las decisiones y requisitos están en [docs/](docs/) y [specs/](specs/).

--- 

## 🚫 Fuera de Alcance

Control directo de impresoras 3D, análisis avanzado de STL, modificación de modelos 3D, app móvil nativa, microservicios y pasarela de pago para el flujo personalizado.

--- 

## 👨‍💻 Equipo

| Nombre | Rol |
|---|---|
| Nicole V. | Scrum Master & Project Manager |
| Gianmarco G. | Product Owner |
| Giancarlo T. | QA / Testing & DevOps Lead |
| Dennis P. | Database & Operations/Cloud Specialist |
| Elder J. | Backend & Architecture Lead |
| Nayeli V. | UI/UX Designer & Frontend Lead |

--- 

## 📄 Licencia

Proyecto académico. Todos los derechos reservados.

--- 