import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
    scenarios: {
        // Scenario 1: นักเรียน 25 คน เข้าเรียนพร้อมกัน
        student_load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 10 },
                { duration: '2m', target: 25 },
                { duration: '2m', target: 0 },
            ],
            exec: 'studentAction', // เรียก function ด้านล่าง
        },
        // Scenario 2: พนักงาน 3 คน จัดการระบบ
        employee_load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 2 },
                { duration: '2m', target: 3 },
                { duration: '2m', target: 0 },
            ],
            exec: 'employeeAction', // เรียก function ด้านล่าง
        },
    },
    thresholds: {
        'http_req_duration{role:student}': ['p(95)<1500'], // นักเรียนต้องรอไม่เกิน 1.5 วินาที
        'http_req_duration{role:employee}': ['p(95)<3000'], // พนักงาน (ฟีเจอร์หนักกว่า) ยอมให้ถึง 3 วินาที
    },
};

// --- ฟังก์ชันสำหรับนักเรียน ---
export function studentAction() {
    group('Student Journey', function () {
        const params = { tags: { role: 'student' } };

        // 1. เข้าห้องเรียน
        let res = http.get('https://api.vcep.com/room/join/event-01', params);
        check(res, { 'student joined': (r) => r.status === 200 });
        sleep(2);

        // 2. พิมพ์ Chat หรือส่ง Emoji (Real-time activity)
        res = http.post('https://api.vcep.com/room/chat', JSON.stringify({ msg: 'Hello!' }), params);
        check(res, { 'chat sent': (r) => r.status === 201 });
        sleep(Math.random() * 5); // จำลองการพิมพ์ไม่พร้อมกัน
    });
}

// --- ฟังก์ชันสำหรับพนักงาน ---
export function employeeAction() {
    group('Employee Journey', function () {
        const params = { tags: { role: 'employee' } };

        // 1. เปิดระบบควบคุมการเรียน
        let res = http.get('https://api.vcep.com/admin/dashboard', params);
        check(res, { 'dashboard loaded': (r) => r.status === 200 });
        sleep(5);

        // 2. ดึงข้อมูล Analytics (งานหนัก)
        res = http.get('https://api.vcep.com/admin/report/realtime', params);
        check(res, { 'report generated': (r) => r.status === 200 });
        sleep(10);
    });
}