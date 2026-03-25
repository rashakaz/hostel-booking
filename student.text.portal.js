const applicationForm = document.getElementById("applicationForm");
const guidelinesToggle = document.getElementById("guidelinesToggle");
const bookingGuidelines = document.getElementById("bookingGuidelines");
const studentTypeSelect = document.getElementById("studentType");
const paymentMethodSelect = document.getElementById("payMethod");
const aedtUploadSection = document.getElementById("aedUpload");
const selfPaySection = document.getElementById("selfPay");
const mpesaField = document.getElementById("pay-mpesa");
const bankField = document.getElementById("pay-bank");
const feedbackBox = document.getElementById("formFeedback");

function setFeedback(message, type) {
  feedbackBox.textContent = message;
  feedbackBox.className = `feedback ${type}`;
}

function clearFeedback() {
  feedbackBox.textContent = "";
  feedbackBox.className = "feedback hidden";
}

async function parseJsonResponse(response) {
  const responseText = await response.text();
  const jsonStart = responseText.indexOf("{");

  if (jsonStart === -1) {
    throw new Error("The server returned an invalid response.");
  }

  return JSON.parse(responseText.slice(jsonStart));
}

function resetConditionalSections() {
  aedtUploadSection.classList.add("hidden");
  selfPaySection.classList.add("hidden");
  mpesaField.classList.add("hidden");
  bankField.classList.add("hidden");
  paymentMethodSelect.value = "";
  document.getElementById("payMpesaNo").value = "";
  document.getElementById("payBankNo").value = "";
}

window.toggleGuidelines = function toggleGuidelines() {
  const isHidden = bookingGuidelines.classList.toggle("hidden");
  guidelinesToggle.textContent = isHidden ? "Show Booking Guidelines" : "Hide Booking Guidelines";
  guidelinesToggle.setAttribute("aria-expanded", String(!isHidden));
};

window.togglePaymentOptions = function togglePaymentOptions() {
  resetConditionalSections();

  if (studentTypeSelect.value === "AEDT") {
    aedtUploadSection.classList.remove("hidden");
    return;
  }

  if (studentTypeSelect.value === "Self") {
    selfPaySection.classList.remove("hidden");
  }
};

window.showPaymentFields = function showPaymentFields() {
  mpesaField.classList.add("hidden");
  bankField.classList.add("hidden");

  if (paymentMethodSelect.value === "mpesa") {
    mpesaField.classList.remove("hidden");
    return;
  }

  if (paymentMethodSelect.value === "bank") {
    bankField.classList.remove("hidden");
  }
};

function validateForm() {
  const requiredFields = [
    { id: "studentName", label: "student name" },
    { id: "studentReg", label: "registration number" },
    { id: "studentEmail", label: "student email" },
    { id: "studentType", label: "student type" },
    { id: "hostel", label: "hostel" },
    { id: "wing", label: "wing" },
    { id: "floor", label: "floor" },
    { id: "room", label: "room number" }
  ];

  for (const field of requiredFields) {
    const element = document.getElementById(field.id);

    if (!element.value.trim()) {
      setFeedback(`Please enter the ${field.label}.`, "error");
      element.focus();
      return false;
    }
  }

  const studentIdFile = document.getElementById("studentIdFile");

  if (!studentIdFile.files.length) {
    setFeedback("Please upload the ID/IA file before submitting.", "error");
    studentIdFile.focus();
    return false;
  }

  if (studentTypeSelect.value === "AEDT") {
    const aedFile = document.getElementById("aedFile");

    if (!aedFile.files.length) {
      setFeedback("Please upload the AEDT sponsorship file.", "error");
      aedFile.focus();
      return false;
    }
  }

  if (studentTypeSelect.value === "Self") {
    if (!paymentMethodSelect.value) {
      setFeedback("Please choose a payment method.", "error");
      paymentMethodSelect.focus();
      return false;
    }

    const paymentReferenceId = paymentMethodSelect.value === "mpesa" ? "payMpesaNo" : "payBankNo";
    const paymentReferenceInput = document.getElementById(paymentReferenceId);

    if (!paymentReferenceInput.value.trim()) {
      setFeedback("Please provide the payment reference details.", "error");
      paymentReferenceInput.focus();
      return false;
    }
  }

  return true;
}

function buildFormData() {
  const formData = new FormData();

  formData.append("studentName", document.getElementById("studentName").value.trim());
  formData.append("studentReg", document.getElementById("studentReg").value.trim());
  formData.append("studentEmail", document.getElementById("studentEmail").value.trim());
  formData.append("studentType", studentTypeSelect.value);
  formData.append("hostel", document.getElementById("hostel").value.trim());
  formData.append("wing", document.getElementById("wing").value.trim());
  formData.append("floor", document.getElementById("floor").value.trim());
  formData.append("room", document.getElementById("room").value.trim());
  formData.append("studentIdFile", document.getElementById("studentIdFile").files[0]);

  if (studentTypeSelect.value === "AEDT") {
    const sponsorshipFile = document.getElementById("aedFile").files[0];
    const sponsorshipMessage = document.getElementById("aedMessage").value.trim();

    formData.append("aedFile", sponsorshipFile);
    formData.append("aedMessage", sponsorshipMessage);
  }

  if (studentTypeSelect.value === "Self") {
    const paymentReference =
      paymentMethodSelect.value === "mpesa"
        ? document.getElementById("payMpesaNo").value.trim()
        : document.getElementById("payBankNo").value.trim();

    formData.append("payMethod", paymentMethodSelect.value);
    formData.append("paymentReference", paymentReference);
  }

  return formData;
}

async function submitApplication(event) {
  event.preventDefault();
  clearFeedback();

  if (window.location.protocol === "file:") {
    setFeedback("Open this page through a PHP server like http://localhost, not by double-clicking the HTML file.", "error");
    return;
  }

  if (!validateForm()) {
    return;
  }

  const submitButton = applicationForm.querySelector(".submit-btn");
  const originalButtonLabel = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    const response = await fetch(applicationForm.getAttribute("action"), {
      method: "POST",
      body: buildFormData()
    });
    const payload = await parseJsonResponse(response);

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "The application could not be saved.");
    }

    applicationForm.reset();
    clearFeedback();
    resetConditionalSections();
    setFeedback("Hostel registration submitted successfully. Status saved as pending.", "success");
  } catch (error) {
    setFeedback(error.message || "An unexpected error occurred while submitting the form.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonLabel;
  }
}

applicationForm.addEventListener("submit", submitApplication);
resetConditionalSections();
