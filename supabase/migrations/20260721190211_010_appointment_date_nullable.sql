/*
# Make appointment_date nullable

Customers no longer pick an appointment time during booking. They pay a
deposit to get on the booking list, and the shop contacts them to coordinate
the appointment. appointment_date must be nullable to support this.
*/

ALTER TABLE appointments ALTER COLUMN appointment_date DROP NOT NULL;
