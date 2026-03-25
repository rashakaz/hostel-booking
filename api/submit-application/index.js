import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { put } from "@vercel/blob";

const allowedExtensions = new Set(["pdf", "jpg", "jpeg", "png"]);

class ValidationError extends Error {}

function json(payload, init = {}) {
  return Response.json(payload, init);
}

function getTrimmedValue(formData, key) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getPaymentReferenceValue(formData) {
  const paymentReference = getTrimmedValue(formData, "paymentReference");

  if (paymentReference !== "") {
    return paymentReference;
  }

  const mpesaReference = getTrimmedValue(formData, "paymentReferenceMpesa");

  if (mpesaReference !== "") {
    return mpesaReference;
  }

  return getTrimmedValue(formData, "paymentReferenceBank");
}

function getFileExtension(filename) {
  const fileParts = filename.toLowerCase().split(".");

  return fileParts.length > 1 ? fileParts.at(-1) : "";
}

function assertDatabaseName(database) {
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error("Database name contains unsupported characters.");
  }
}

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const database = process.env.MYSQL_DATABASE;

  if (!database) {
    throw new Error("Missing MYSQL_DATABASE environment variable.");
  }

  assertDatabaseName(database);

  return {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database,
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

async function ensureDatabaseSchema(connection) {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS hostel_applications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_name VARCHAR(150) NOT NULL,
      registration_number VARCHAR(50) NOT NULL,
      student_email VARCHAR(190) NOT NULL,
      student_type ENUM('AEDT', 'Self') NOT NULL,
      hostel VARCHAR(50) NOT NULL,
      wing VARCHAR(50) NOT NULL,
      floor_level VARCHAR(50) NOT NULL,
      room_number VARCHAR(20) NOT NULL,
      student_id_file VARCHAR(255) NOT NULL,
      sponsorship_file VARCHAR(255) DEFAULT NULL,
      sponsorship_message TEXT DEFAULT NULL,
      payment_method ENUM('mpesa', 'bank') DEFAULT NULL,
      payment_reference VARCHAR(100) DEFAULT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_registration_number (registration_number),
      KEY idx_student_email (student_email),
      KEY idx_status (status),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN environment variable.");
  }

  return token;
}

async function storeFile(file, folder) {
  if (!(file instanceof File) || file.size === 0) {
    throw new ValidationError(`Missing required upload: ${folder}`);
  }

  const extension = getFileExtension(file.name);

  if (!allowedExtensions.has(extension)) {
    throw new ValidationError(`Invalid file type uploaded for ${folder}.`);
  }

  const blob = await put(
    `${folder}/${crypto.randomUUID()}.${extension}`,
    file,
    {
      access: "public",
      token: getBlobToken(),
      addRandomSuffix: false,
    }
  );

  return blob.url;
}

function validatePayload(payload) {
  const requiredValues = [
    payload.studentName,
    payload.studentReg,
    payload.studentEmail,
    payload.studentType,
    payload.hostel,
    payload.wing,
    payload.floor,
    payload.room,
  ];

  if (requiredValues.some((value) => value === "")) {
    throw new ValidationError("Please complete all required fields.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.studentEmail)) {
    throw new ValidationError("Please provide a valid student email address.");
  }

  if (!["AEDT", "Self"].includes(payload.studentType)) {
    throw new ValidationError("Invalid student type selected.");
  }

  if (payload.studentType === "Self") {
    if (!["mpesa", "bank"].includes(payload.payMethod)) {
      throw new ValidationError("Please choose a valid payment method.");
    }

    if (payload.paymentReference === "") {
      throw new ValidationError("Please provide the payment reference details.");
    }
  }
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json(
        { success: false, message: "Only POST requests are allowed." },
        { status: 405 }
      );
    }

    let connection;

    try {
      const formData = await request.formData();
      const payload = {
        studentName: getTrimmedValue(formData, "studentName"),
        studentReg: getTrimmedValue(formData, "studentReg"),
        studentEmail: getTrimmedValue(formData, "studentEmail"),
        studentType: getTrimmedValue(formData, "studentType"),
        hostel: getTrimmedValue(formData, "hostel"),
        wing: getTrimmedValue(formData, "wing"),
        floor: getTrimmedValue(formData, "floor"),
        room: getTrimmedValue(formData, "room"),
        aedMessage: getTrimmedValue(formData, "aedMessage"),
        payMethod: getTrimmedValue(formData, "payMethod"),
        paymentReference: getPaymentReferenceValue(formData),
      };

      validatePayload(payload);

      const studentIdFile = formData.get("studentIdFile");
      const aedFile = formData.get("aedFile");

      if (!(studentIdFile instanceof File) || studentIdFile.size === 0) {
        return json(
          { success: false, message: "Please upload the ID/IA file before submitting." },
          { status: 422 }
        );
      }

      if (payload.studentType === "AEDT" && (!(aedFile instanceof File) || aedFile.size === 0)) {
        return json(
          { success: false, message: "Please upload the AEDT sponsorship file." },
          { status: 422 }
        );
      }

      const studentIdPath = await storeFile(studentIdFile, "student-ids");
      let sponsorshipPath = null;

      if (payload.studentType === "AEDT") {
        sponsorshipPath = await storeFile(aedFile, "sponsorships");
      } else {
        payload.aedMessage = "";
      }

      if (payload.studentType !== "Self") {
        payload.payMethod = "";
        payload.paymentReference = "";
      }

      connection = await mysql.createConnection(getDatabaseConfig());
      await ensureDatabaseSchema(connection);
      await connection.execute(
        `INSERT INTO hostel_applications (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), ?)`,
        [
          payload.studentName,
          payload.studentReg,
          payload.studentEmail,
          payload.studentType,
          payload.hostel,
          payload.wing,
          payload.floor,
          payload.room,
          studentIdPath,
          sponsorshipPath || "",
          payload.aedMessage,
          payload.payMethod,
          payload.paymentReference,
          "pending",
        ]
      );

      return json({
        success: true,
        message: "Hostel application saved successfully.",
      });
    } catch (error) {
      return json(
        {
          success: false,
          message: error instanceof Error ? error.message : "An unexpected error occurred.",
        },
        { status: error instanceof ValidationError ? 422 : 500 }
      );
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  },
};
