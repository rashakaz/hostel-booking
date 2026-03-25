<?php

declare(strict_types=1);

function getDatabaseConfig(): array
{
    $database = getenv('DB_DATABASE') ?: 'hostel_booking_portal';

    if (!preg_match('/^[A-Za-z0-9_]+$/', $database)) {
        throw new RuntimeException('Database name contains unsupported characters.');
    }

    return [
        'host' => getenv('DB_HOST') ?: 'localhost',
        'port' => (int) (getenv('DB_PORT') ?: '3306'),
        'username' => getenv('DB_USERNAME') ?: 'root',
        'password' => getenv('DB_PASSWORD') ?: '',
        'database' => $database,
    ];
}

function ensureDatabaseSchema(mysqli $connection, string $database): void
{
    $connection->query(
        sprintf(
            'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
            $connection->real_escape_string($database)
        )
    );

    if (!$connection->select_db($database)) {
        throw new RuntimeException('Failed to select the application database.');
    }

    $connection->query(
        'CREATE TABLE IF NOT EXISTS hostel_applications (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            student_name VARCHAR(150) NOT NULL,
            registration_number VARCHAR(50) NOT NULL,
            student_email VARCHAR(190) NOT NULL,
            student_type ENUM(\'AEDT\', \'Self\') NOT NULL,
            hostel VARCHAR(50) NOT NULL,
            wing VARCHAR(50) NOT NULL,
            floor_level VARCHAR(50) NOT NULL,
            room_number VARCHAR(20) NOT NULL,
            student_id_file VARCHAR(255) NOT NULL,
            sponsorship_file VARCHAR(255) DEFAULT NULL,
            sponsorship_message TEXT DEFAULT NULL,
            payment_method ENUM(\'mpesa\', \'bank\') DEFAULT NULL,
            payment_reference VARCHAR(100) DEFAULT NULL,
            status ENUM(\'pending\', \'approved\', \'rejected\') NOT NULL DEFAULT \'pending\',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_registration_number (registration_number),
            KEY idx_student_email (student_email),
            KEY idx_status (status),
            KEY idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function getDatabaseConnection(): mysqli
{
    $config = getDatabaseConfig();

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $connection = new mysqli(
        $config['host'],
        $config['username'],
        $config['password'],
        '',
        $config['port']
    );

    if ($connection->connect_error) {
        throw new RuntimeException('Database connection failed: ' . $connection->connect_error);
    }

    $connection->set_charset('utf8mb4');
    ensureDatabaseSchema($connection, $config['database']);

    return $connection;
}
