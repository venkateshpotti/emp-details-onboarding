// 1. Import Dependencies
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
// 2. Initialize App and Port
const app = express();
const port = 3000;

// 3. PostgreSQL Connection Pool
// !!! IMPORTANT: Replace with your actual PostgreSQL credentials !!!
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'emp_details_db',
    password: '1234', // <-- CHANGE THIS TO YOUR PASSWORD
    port: 5432,
});

// 4. Multer Configuration for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// 5. Middleware

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 6. Database Table Creation Function
const initializeDatabase = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            first_name VARCHAR(100), last_name VARCHAR(100), date_of_birth DATE, gender VARCHAR(20),
            marital_status VARCHAR(20), personal_email VARCHAR(255), phone VARCHAR(20), alternate_phone VARCHAR(20),
            nationality VARCHAR(100), permanent_address JSONB, current_address JSONB, emergency_contacts JSONB,
            education_history JSONB, work_experience JSONB, insurance_info JSONB, bank_info JSONB,
            id_proof_path VARCHAR(255), resume_path VARCHAR(255), signed_document_path VARCHAR(255),
            agreed_terms BOOLEAN, agreed_privacy BOOLEAN, signature_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    try {
        await pool.query(createTableQuery);
        console.log('Table "employees" is ready.');
    } catch (err) {
        console.error('Error creating table:', err.stack);
    }
};

// 7. API Routes

// GET / - Serve the main HTML form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /hr - Serve the HR dashboard page
app.get('/hr', (req, res) => {
    res.sendFile(path.join(__dirname, 'hr.html'));
});

// GET /api/employees - Get a list of all employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, first_name, last_name, created_at FROM employees ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching employees list:', err);
        res.status(500).json({ error: 'Failed to fetch employee list.' });
    }
});

// GET /api/employees/:id - Get full details for one employee
app.get('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error fetching employee ${req.params.id}:`, err);
        res.status(500).json({ error: 'Failed to fetch employee details.' });
    }
});


// POST /api/onboarding - Handle the form submission
app.post('/api/onboarding', upload.any(), async (req, res) => {
    
    console.log('--- Received Body ---');
    console.log(req.body);
    console.log('--- Received Files ---');
    console.log(req.files);
    
    try {
        const { body, files } = req;
        const getFilePath = (fieldName) => files.find(f => f.fieldname === fieldName)?.path || null;

        const permanent_address = { street: body.permanentStreet, city: body.permanentCity, state: body.permanentState, zip: body.permanentZip, country: body.permanentCountry };
        const current_address = { street: body.currentStreet, city: body.currentCity, state: body.currentState, zip: body.currentZip, country: body.currentCountry };
        const emergency_contacts = [
            { type: 'primary', name: body.emergencyName1, relationship: body.emergencyRelationship1, phone: body.emergencyPhone1, email: body.emergencyEmail1 },
            { type: 'secondary', name: body.emergencyName2, relationship: body.emergencyRelationship2, phone: body.emergencyPhone2, email: body.emergencyEmail2 },
        ];
        
        const education_history = {
            ssc: { school: body['education[ssc][school]'], year: body['education[ssc][year]'], grade: body['education[ssc][grade]'], certificate: getFilePath('education[ssc][certificate]') },
            inter: { college: body['education[inter][college]'], year: body['education[inter][year]'], grade: body['education[inter][grade]'], branch: body['education[inter][branch]'], certificate: getFilePath('education[inter][certificate]') },
            grad: { college: body['education[grad][college]'], year: body['education[grad][year]'], grade: body['education[grad][grade]'], degree: body['education[grad][degree]'], branch: body['education[grad][branch]'], certificate: getFilePath('education[grad][certificate]') },
            additional: []
        };
        for (let i = 0; i < 2; i++) {
            if (body[`additionalEducation[${i}][college]`]) {
                education_history.additional.push({
                    college: body[`additionalEducation[${i}][college]`],
                    year: body[`additionalEducation[${i}][year]`],
                    grade: body[`additionalEducation[${i}][grade]`],
                    degree: body[`additionalEducation[${i}][degree]`],
                    branch: body[`additionalEducation[${i}][branch]`],
                    certificate: getFilePath(`additionalEducation[${i}][certificate]`)
                });
            }
        }

        // Work Experience (including dynamic fields)
        const work_experience = [];
        if (body.hasExperience) {
            for (let i = 0; i < 3; i++) { // Check for up to 3 experiences
                if (body[`experience[${i}][company]`]) {
                    // --- FIX WAS HERE ---
                    // Removed fields that don't exist in the form: 
                    // currentJob, employeeId, supervisorName
                    work_experience.push({
                        company: body[`experience[${i}][company]`],
                        jobTitle: body[`experience[${i}][jobTitle]`],
                        startDate: body[`experience[${i}][startDate]`],
                        endDate: body[`experience[${i}][endDate]`],
                        description: body[`experience[${i}][description]`],
                        certificate: getFilePath(`experience[${i}][certificate]`),
                    });
                }
            }
        }

        // Insurance Info (including dynamic fields)
        const insurance_info = [];
        if (body.hasInsurance) {
             for (let i = 0; i < 3; i++) {
                if (body[`insurance[${i}][provider]`]) {
                    // --- FIX WAS HERE ---
                    // Removed fields that don't exist in the form:
                    // coverageType, expirationDate
                    insurance_info.push({
                        provider: body[`insurance[${i}][provider]`],
                        policyNumber: body[`insurance[${i}][policyNumber]`],
                        document: getFilePath(`insurance[${i}][document]`)
                    });
                }
            }
        }

        const bank_info = { bankName: body.bankName, accountName: body.accountName, accountNumber: body.accountNumber, routingNumber: body.routingNumber, iban: body.iban, bankAddress: body.bankAddress };

        const insertQuery = `
            INSERT INTO employees (
                first_name, last_name, date_of_birth, gender, marital_status, personal_email, phone, alternate_phone, nationality,
                permanent_address, current_address, emergency_contacts, education_history, work_experience, insurance_info, bank_info,
                id_proof_path, resume_path, signed_document_path,
                agreed_terms, agreed_privacy, signature_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING id;
        `;
        const values = [
            body.firstName, body.lastName, body.dateOfBirth, body.gender, body.maritalStatus, body.personalEmail, body.phone, body.alternatePhone, body.nationality,
            JSON.stringify(permanent_address), JSON.stringify(current_address), JSON.stringify(emergency_contacts),
            JSON.stringify(education_history), JSON.stringify(work_experience), JSON.stringify(insurance_info), JSON.stringify(bank_info),
            getFilePath('idProof'), getFilePath('resume'), getFilePath('signedDocument'),
            !!body.agreeTerms, !!body.agreePrivacy, body.signatureDate
        ];

        const result = await pool.query(insertQuery, values);
        console.log('SUCCESS: New employee onboarded with ID:', result.rows[0].id);
        res.status(201).json({ success: true, message: 'Form submitted successfully!', employeeId: result.rows[0].id });

    } catch (dbErr) {
        console.error('SERVER ERROR:', dbErr);
        res.status(500).json({ success: false, error: 'An error occurred on the server.' });
    }
});

// 8. Start the Server
app.listen(port, () => {
    initializeDatabase();
    console.log(`Server running at http://localhost:${port}`);
    console.log(`HR dashboard available at http://localhost:${port}/hr`);
});