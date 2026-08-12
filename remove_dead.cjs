const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace('import jwt from "jsonwebtoken";\n', '');
code = code.replace('import jwt from "jsonwebtoken";\r\n', '');
code = code.replace('import bcrypt from "bcryptjs";\n', '');
code = code.replace('import bcrypt from "bcryptjs";\r\n', '');

code = code.replace(/\/\/ -- In-Memory DB --[\s\S]*?seedData\(\);\r?\n/g, '');

fs.writeFileSync('server.ts', code);
