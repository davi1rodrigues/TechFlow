CREATE DATABASE IF NOT EXISTS techflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE techflow;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  senha_hash VARCHAR(60) NOT NULL,
  perfil ENUM('solicitante', 'tecnico', 'admin') NOT NULL DEFAULT 'solicitante',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  INDEX idx_usuarios_perfil_ativo (perfil, ativo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categorias (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(80) NOT NULL,
  descricao VARCHAR(255) NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  CONSTRAINT uq_categorias_nome UNIQUE (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tecnico_especialidades (
  tecnico_id BIGINT UNSIGNED NOT NULL,
  categoria_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (tecnico_id, categoria_id),
  CONSTRAINT fk_especialidades_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES usuarios (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_especialidades_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chamados (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  solicitante_id BIGINT UNSIGNED NOT NULL,
  tecnico_id BIGINT UNSIGNED NULL,
  categoria_id BIGINT UNSIGNED NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  descricao TEXT NOT NULL,
  prioridade ENUM('baixa', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
  status ENUM('aberto', 'em_atendimento', 'aguardando_usuario', 'resolvido', 'fechado') NOT NULL DEFAULT 'aberto',
  solucao TEXT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_chamados_solicitante (solicitante_id),
  INDEX idx_chamados_tecnico_status (tecnico_id, status),
  INDEX idx_chamados_categoria (categoria_id),
  CONSTRAINT fk_chamados_solicitante
    FOREIGN KEY (solicitante_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_chamados_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES usuarios (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_chamados_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_chamado_solucao_resolvido
    CHECK (status NOT IN ('resolvido', 'fechado') OR solucao IS NOT NULL)
) ENGINE=InnoDB;
