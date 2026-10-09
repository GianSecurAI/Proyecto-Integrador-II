-- V8: initial catalog. Products with their photo (imagen_url points to a static file served by the front end under /images/products).

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Claude Clickeable', 'Llavero con la mascota pixelada de Claude en 3D, con forma de cubo y acabado naranja brillante.', 24.90, '/images/products/claude-clickeable.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros articulados', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Claude Clickeable';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero Claude Clickeable';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Impreso en 3D' FROM producto WHERE nombre = 'Llavero Claude Clickeable';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Claude Normal', 'Llavero plano de la mascota pixelada de Claude con ojos clasicos.', 18.90, '/images/products/claude-normal.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Claude Normal';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero Claude Normal';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Claude Ojos Alegres', 'Llavero plano de la mascota pixelada de Claude con ojos alegres.', 18.90, '/images/products/claude-ojos-alegres.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Claude Ojos Alegres';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero Claude Ojos Alegres';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Claude Ojos Entrecerrados', 'Llavero plano de la mascota pixelada de Claude con ojos entrecerrados.', 18.90, '/images/products/claude-ojos-entrecerrados.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Claude Ojos Entrecerrados';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero Claude Ojos Entrecerrados';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Circular Bitcoin Pizza Day', 'Llavero circular en dos colores que conmemora el Bitcoin Pizza Day del 22 de mayo de 2010.', 21.90, '/images/products/llavero-bitcoin-pizza-day.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Circular Bitcoin Pizza Day';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Dos colores' FROM producto WHERE nombre = 'Llavero Circular Bitcoin Pizza Day';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero Circular Bitcoin Pizza Day';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Dinosaurio flexible', 'Dinosaurio articulado impreso en una sola pieza, con segmentos que se mueven.', 22.90, '/images/products/llavero-dinosaurio-flexible.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros articulados', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Dinosaurio flexible';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Articulado' FROM producto WHERE nombre = 'Llavero Dinosaurio flexible';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Impreso en una sola pieza' FROM producto WHERE nombre = 'Llavero Dinosaurio flexible';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero GitHub', 'Llavero circular con el Octocat de GitHub en blanco sobre fondo negro.', 19.90, '/images/products/llavero-github.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero GitHub';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Dos colores' FROM producto WHERE nombre = 'Llavero GitHub';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero GitHub';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Kiro', 'Llavero con la forma del fantasma de Kiro en blanco, con argolla de color.', 19.90, '/images/products/llavero-kiro.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Kiro';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Incluye argolla de color' FROM producto WHERE nombre = 'Llavero Kiro';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Kubernetes', 'Llavero hexagonal con el timon de Kubernetes en azul y blanco.', 21.90, '/images/products/llavero-kubernetes.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Kubernetes';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Dos colores' FROM producto WHERE nombre = 'Llavero Kubernetes';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero Kubernetes';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Llavero Ollama', 'Llavero con la llama de Ollama en blanco y negro.', 19.90, '/images/products/llavero-ollama.webp', TRUE, CURRENT_TIMESTAMP, 'LLAVERO', 'Llaveros de tecnologia', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Llavero Ollama';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Dos colores' FROM producto WHERE nombre = 'Llavero Ollama';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Incluye argolla metalica' FROM producto WHERE nombre = 'Llavero Ollama';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Muñequito Claude articulado', 'Figura de la mascota de Claude con piernas articuladas para sentarla en el borde de tu escritorio.', 39.90, '/images/products/munequito-claude-articulado.webp', TRUE, CURRENT_TIMESTAMP, 'FIGURA', 'Figuras articuladas', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Muñequito Claude articulado';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Piernas articuladas' FROM producto WHERE nombre = 'Muñequito Claude articulado';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Impreso en 3D' FROM producto WHERE nombre = 'Muñequito Claude articulado';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Ferris, mascota de Rust', 'Figura de Ferris, el cangrejo mascota del lenguaje Rust, con acabado naranja.', 34.90, '/images/products/ferris-mascota-de-rust.webp', TRUE, CURRENT_TIMESTAMP, 'FIGURA', 'Figuras de coleccion', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Ferris, mascota de Rust';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Impreso en 3D' FROM producto WHERE nombre = 'Ferris, mascota de Rust';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Claude Coin', 'Moneda decorativa con la mascota de Claude en relieve, en naranja y negro.', 12.90, '/images/products/claude-coin.webp', TRUE, CURRENT_TIMESTAMP, 'DECORACION', 'Monedas decorativas', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Claude Coin';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Dos colores' FROM producto WHERE nombre = 'Claude Coin';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Venta por unidad' FROM producto WHERE nombre = 'Claude Coin';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('DeepSeek Desk Decor', 'Placa decorativa de escritorio con el logo de DeepSeek en azul.', 44.90, '/images/products/deepseek-desk-decor.webp', TRUE, CURRENT_TIMESTAMP, 'DECORACION', 'Decoracion de escritorio', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'DeepSeek Desk Decor';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Base estable' FROM producto WHERE nombre = 'DeepSeek Desk Decor';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Impreso en 3D' FROM producto WHERE nombre = 'DeepSeek Desk Decor';

INSERT INTO producto (nombre, descripcion, precio_referencial, imagen_url, estado, fecha_registro, categoria, subcategoria, fecha_actualizacion)
    VALUES ('Posavasos «En mi máquina sí funciona»', 'Posavasos redondo con el lema «It works on my machine», en negro y blanco.', 16.90, '/images/products/posavasos-it-works.webp', TRUE, CURRENT_TIMESTAMP, 'DECORACION', 'Posavasos', CURRENT_TIMESTAMP);
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 0, 'Material: PLA' FROM producto WHERE nombre = 'Posavasos «En mi máquina sí funciona»';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 1, 'Dos colores' FROM producto WHERE nombre = 'Posavasos «En mi máquina sí funciona»';
INSERT INTO producto_caracteristica (id_producto, orden, texto)
    SELECT id_producto, 2, 'Venta por unidad' FROM producto WHERE nombre = 'Posavasos «En mi máquina sí funciona»';
