<?php

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('html_errors', '0');

header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function getTrimmedPostValue(string $key): string
{
    return isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
}

function getPaymentReferenceValue(): string
{
    $paymentReference = getTrimmedPostValue('paymentReference');

    if ($paymentReference !== '') {
        return $paymentReference;
    }

    $mpesaReference = getTrimmedPostValue('paymentReferenceMpesa');

    if ($mpesaReference !== '') {
        return $mpesaReference;
    }

    return getTrimmedPostValue('paymentReferenceBank');
}

function ensureUploadDirectory(string $path): void
{
    if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
        throw new RuntimeException('Failed to create upload directory.');
    }
}

function storeUploadedFile(string $fieldName, string $targetDirectory): string
{
    if (!isset($_FILES[$fieldName]) || $_FILES[$fieldName]['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Missing required upload: ' . $fieldName);
    }

    $originalName = (string) $_FILES[$fieldName]['name'];
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!in_array($extension, $allowedExtensions, true)) {
        throw new RuntimeException('Invalid file type uploaded for ' . $fieldName . '.');
    }

    ensureUploadDirectory($targetDirectory);

    $generatedName = bin2hex(random_bytes(16)) . '.' . $extension;
    $destination = $targetDirectory . DIRECTORY_SEPARATOR . $generatedName;

    if (!move_uploaded_file((string) $_FILES[$fieldName]['tmp_name'], $destination)) {
        throw new RuntimeException('Unable to move uploaded file for ' . $fieldName . '.');
    }

    $relativePath = str_replace(__DIR__ . DIRECTORY_SEPARATOR, '', $destination);

    return str_replace(DIRECTORY_SEPARATOR, '/', $relativePath);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Only POST requests are allowed.']);
}

$studentName = getTrimmedPostValue('studentName');
$studentReg = getTrimmedPostValue('studentReg');
$studentEmail = getTrimmedPostValue('studentEmail');
$studentType = getTrimmedPostValue('studentType');
$hostel = getTrimmedPostValue('hostel');
$wing = getTrimmedPostValue('wing');
$floor = getTrimmedPostValue('floor');
$room = getTrimmedPostValue('room');
$aedMessage = getTrimmedPostValue('aedMessage');
$payMethod = getTrimmedPostValue('payMethod');
$paymentReference = getPaymentReferenceValue();

if (
    $studentName === '' ||
    $studentReg === '' ||
    $studentEmail === '' ||
    $studentType === '' ||
    $hostel === '' ||
    $wing === '' ||
    $floor === '' ||
    $room === ''
) {
    respond(422, ['success' => false, 'message' => 'Please complete all required fields.']);
}

if (!filter_var($studentEmail, FILTER_VALIDATE_EMAIL)) {
    respond(422, ['success' => false, 'message' => 'Please provide a valid student email address.']);
}

if (!in_array($studentType, ['AEDT', 'Self'], true)) {
    respond(422, ['success' => false, 'message' => 'Invalid student type selected.']);
}

if ($studentType === 'AEDT' && !isset($_FILES['aedFile'])) {
    respond(422, ['success' => false, 'message' => 'Please upload the AEDT sponsorship file.']);
}

if ($studentType === 'Self') {
    if (!in_array($payMethod, ['mpesa', 'bank'], true)) {
        respond(422, ['success' => false, 'message' => 'Please choose a valid payment method.']);
    }

    if ($paymentReference === '') {
        respond(422, ['success' => false, 'message' => 'Please provide the payment reference details.']);
    }
}

try {
    $studentIdPath = storeUploadedFile('studentIdFile', __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'student_ids');
    $sponsorshipPath = '';

    if ($studentType === 'AEDT') {
        $sponsorshipPath = storeUploadedFile('aedFile', __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'sponsorships');
    }

    if ($studentType !== 'AEDT') {
        $aedMessage = '';
    }

    if ($studentType !== 'Self') {
        $payMethod = '';
        $paymentReference = '';
    }

    $connection = getDatabaseConnection();
    $statement = $connection->prepare(
        'INSERT INTO hostel_applications (
            student_name,
            registration_number,
            student_email,
            student_type,
            hostel,
            wing,
            floor_level,
            room_number,
            student_id_file,
            sponsorship_file,
            sponsorship_message,
            payment_method,
            payment_reference,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, \'\'), NULLIF(?, \'\'), NULLIF(?, \'\'), NULLIF(?, \'\'), ?)'
    );

    if (!$statement) {
        throw new RuntimeException('Failed to prepare database statement.');
    }

    $status = 'pending';
    $statement->bind_param(
        'ssssssssssssss',
        $studentName,
        $studentReg,
        $studentEmail,
        $studentType,
        $hostel,
        $wing,
        $floor,
        $room,
        $studentIdPath,
        $sponsorshipPath,
        $aedMessage,
        $payMethod,
        $paymentReference,
        $status
    );

    if (!$statement->execute()) {
        throw new RuntimeException('Failed to save the hostel application.');
    }

    $statement->close();
    $connection->close();
} catch (Throwable $exception) {
    respond(500, ['success' => false, 'message' => $exception->getMessage()]);
}

respond(200, ['success' => true, 'message' => 'Hostel application saved successfully.']);
