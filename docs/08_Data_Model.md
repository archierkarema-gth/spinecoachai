# Data Model

Entities

User
Assessment
Goals
Exercise
WorkoutPlan
WorkoutLog
PainLog
RecoveryLog
Photo
MedicalRecord
Report

Relationships:
User owns all records.
WorkoutPlan references Exercises.
WorkoutLog references WorkoutPlan.