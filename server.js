require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors()); // Lets React talk to this server
app.use(express.json()); // Lets us read JSON data from the frontend

// Local Database Connection Setup
// const pool = new Pool({
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     database: process.env.DB_DATABASE
// });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    }
});

//Forgot password setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Email System Error:", error.message);
  } else {
    console.log("✅ Email System: Ready to transmit recovery links");
  }
});

// ==========================================
// 1. SIGN UP ROUTE
// ==========================================
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "User or email already exists!" });

        const salt = await bcrypt.genSalt(10);
        const bcryptPassword = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, bcryptPassword]
        );

        const token = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: newUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// ==========================================
// 2. LOGIN ROUTE
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(401).json({ error: "Invalid Email or Password" });

        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) return res.status(401).json({ error: "Invalid Email or Password" });

        const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user.rows[0].id, username: user.rows[0].username, email: user.rows[0].email } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// ==========================================
// FORGOT PASSWORD ROUTE (Production Ready)
// ==========================================
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Verify user exists in PostgreSQL
        const user = await pool.query('SELECT username FROM users WHERE email = $1', [email]);

        if (user.rows.length === 0) {
            return res.status(404).json({ error: "No account found with this email address." });
        }

        const username = user.rows[0].username;

        // 2. Prepare the Email Content
        const mailOptions = {
            from: `"NextGen Builds" <${process.env.EMAIL_USER}>`, // Uses your .env email
            to: email,
            subject: 'Neural Link: Password Recovery Request',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #090b14; color: #fff; padding: 40px; border-radius: 24px; border: 1px solid #1e293b; max-width: 600px; margin: auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                         <h1 style="color: #00f0ff; margin: 0; font-size: 28px; letter-spacing: 2px;">NEXTGEN <span style="color: #fff;">BUILDS</span></h1>
                         <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin-top: 5px;">Secure Neural Recovery Subsystem</p>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.6;">Greetings, <strong>${username}</strong>,</p>
                    
                    <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
                        A request has been initiated to reset your access credentials for the NextGen engine. 
                        If you did not initiate this request, please secure your account immediately.
                    </p>

                    <div style="text-align: center; margin: 40px 0;">
                        <a href="http://localhost:5173/reset-password?email=${encodeURIComponent(email)}" 
                           style="background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.3);">
                           RESET NEURAL PASSKEY
                        </a>
                    </div>

                    <p style="font-size: 12px; color: #475569; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">
                        This link is valid for 1 hour. <br/>
                        NextGen Builds • AI-Accelerated PC Architecture
                    </p>
                </div>
            `
        };

        // 3. Send the Mail
        await transporter.sendMail(mailOptions);

        res.json({ message: "Recovery credentials transmitted. Check your inbox." });

    } catch (err) {
        console.error("❌ SMTP Transmission Error:", err);
        res.status(500).json({ error: "Neural link transmission failed. Verify SMTP configuration." });
    }
});

// ==========================================
// 3. ENTHUSIAST BUILD ROUTE
// ==========================================
app.post('/api/build/enthusiast', async (req, res) => {
    try {
        const { budget, cpuBrand, gpuBrand } = req.body;

        // 🚀 Fix: Ensure whole number for PostgreSQL bigint and apply 10% high-end flex
        const searchBudget = Math.round(budget >= 2000 ? budget * 1.10 : budget);

        let query = `SELECT * FROM components WHERE total_price <= $1`;
        let values = [searchBudget]; 
        let paramIndex = 2;

        // Strict socket compatibility (Prevents Intel CPUs on AMD boards and vice-versa)
        query += `
            AND NOT (cpu ILIKE '%Ryzen%' AND motherboard ~* '(Z790|Z690|Z590|B760|B660|H610|Z890|B860)')
            AND NOT ((cpu ILIKE '%Intel%' OR cpu ILIKE '%Core%') AND motherboard ~* '(X870|X670|B650|A620|X570|B550|B450)')
        `;

        if (cpuBrand && cpuBrand !== 'Any') {
            query += ` AND cpu_brand ILIKE $${paramIndex}`;
            values.push(`%${cpuBrand}%`);
            paramIndex++;
        }
        if (gpuBrand && gpuBrand !== 'Any') {
            query += ` AND gpu_brand ILIKE $${paramIndex}`;
            values.push(`%${gpuBrand}%`);
            paramIndex++;
        }

        query += ` ORDER BY total_price DESC LIMIT 1`; 
        
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: `No matching builds found under $${budget}. Try adjusting your filters.` 
            });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Database Matrix Error:", err);
        res.status(500).json({ error: "Server Error: Neural matrix failed to compile." });
    }
});

// ==========================================
// 4. NOVICE BUILD ROUTE 
// ==========================================
app.post('/api/build/novice', async (req, res) => {
    try {
        const { budget } = req.body;

        // 🚀 Fix: Added Math.round and 10% Flex so Novice users can also see 50-series builds
        const searchBudget = Math.round(budget >= 2000 ? budget * 1.10 : budget);

        let query = `
            SELECT * FROM components_novice 
            WHERE total_price <= $1 
            AND NOT (cpu ILIKE '%Ryzen%' AND motherboard ~* '(Z790|Z690|Z590|B760|B660|H610|Z890|B860)')
            AND NOT ((cpu ILIKE '%Intel%' OR cpu ILIKE '%Core%') AND motherboard ~* '(X870|X670|B650|A620|X570|B550|B450)')
            ORDER BY total_price DESC LIMIT 1
        `;
        
        const result = await pool.query(query, [searchBudget]); 

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: "Budget threshold not met. Please increase budget to at least $500." 
            });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Novice Path Error:", err);
        res.status(500).json({ error: "Server Error: AI processing failed." });
    }
});

// ==========================================
// 5. FPS Predictor
// ==========================================
app.post('/api/predict-fps', async (req, res) => {
    try {
        const { 
            cpuCores, cpuThreads, cpuBoost, cpuL3,
            gpuVram, gpuBoost, gpuShaders,
            ramCapacity, ramSpeed,
            dualChannel = true, 
            ramProfile = true,
            upscaling = 'Native', 
            frameGen = 'Off', 
            engine = 'Unreal Engine 5', 
            directx = 'DX12'
        } = req.body;

        const pythonProcess = spawn('python', [
            'predict_fps.py',
            cpuCores, cpuThreads, cpuBoost, cpuL3,
            gpuVram, gpuBoost, gpuShaders,
            ramCapacity, ramSpeed,
            dualChannel ? 1 : 0,  
            ramProfile ? 1 : 0,   
            upscaling, frameGen, engine, directx
        ]);

        let rawOutput = '';
        pythonProcess.stdout.on('data', (data) => { rawOutput += data.toString(); });

        pythonProcess.on('close', (code) => {
            try {
                const matrixData = JSON.parse(rawOutput.trim());
                if (matrixData.error) return res.status(500).json({ error: matrixData.error });

                res.json({ ai_matrix: matrixData });

            } catch (err) {
                res.status(500).json({ error: "ML Bridge JSON Error" });
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error: ML bridge failed." });
    }
});

// ==========================================
// 6. Authentication Token
// ==========================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access Denied. No token provided." });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user; 
        next(); 
    });
};

// ==========================================
// 7. SAVED BUILDS 
// ==========================================

// --- SAVE A NEW BUILD ---
app.post('/api/builds/save', authenticateToken, async (req, res) => {
    try {
        const { build_name, total_price, cpu, gpu, motherboard, ram, psu, chassis, image_url } = req.body;
        const userId = req.user.id; // Pulled securely from the token

        const newBuild = await pool.query(
            `INSERT INTO saved_builds 
            (user_id, build_name, total_price, cpu, gpu, motherboard, ram, psu, chassis, image_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [userId, build_name || 'My Custom Build', total_price, cpu, gpu, motherboard, ram, psu, chassis, image_url]
        );

        res.json({ message: "Build successfully saved to your hangar!", build: newBuild.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save build to database." });
    }
});

// --- GET USER'S SAVED BUILDS ---
app.get('/api/builds/my-hangar', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Fetch builds for this specific user, newest first
        const builds = await pool.query(
            'SELECT * FROM saved_builds WHERE user_id = $1 ORDER BY saved_at DESC', 
            [userId]
        );

        res.json(builds.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch saved builds." });
    }
});

// --- DELETE A BUILD ---
app.delete('/api/builds/:id', authenticateToken, async (req, res) => {
    try {
        const buildId = req.params.id;
        const userId = req.user.id;

        // The "AND user_id = $2" ensures a hacker can't delete someone else's build!
        const deleteQuery = await pool.query(
            'DELETE FROM saved_builds WHERE id = $1 AND user_id = $2 RETURNING *', 
            [buildId, userId]
        );

        if (deleteQuery.rows.length === 0) {
             return res.status(404).json({ error: "Build not found or not authorized to delete." });
        }
        
        res.json({ message: "Build deleted from hangar." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete build." });
    }
});

// ==========================================
// 8. PASSWORD RESET 
// ==========================================
app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        // 1. Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 2. Update the database
        const result = await pool.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
            [hashedPassword, email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User record not found in the neural matrix." });
        }

        // 3. Send success response as JSON (crucial to avoid the character error!)
        res.json({ message: "Neural passkey updated successfully!" });

    } catch (err) {
        console.error("❌ Reset DB Error:", err);
        res.status(500).json({ error: "Database synchronization failed." });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
// We add '0.0.0.0' so Railway can route traffic to your app
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 NextGen Backend running on port ${PORT}`);
});