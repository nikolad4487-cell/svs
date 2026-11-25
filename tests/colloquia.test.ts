import{test}from'node:test';import assert from'node:assert/strict';
import{colloquiumSchema,colloquiumMonth}from'../src/lib/academic/colloquia';
const values={institution_id:'10000000-0000-4000-8000-000000000001',course_id:'20000000-0000-4000-8000-000000000001',title:'Prvi kolokvij',starts_at:'2026-12-15T10:00',registration_deadline:'2026-12-14T20:00',withdrawal_deadline:'2026-12-14T21:00',capacity:'30'};
test('colloquia use Croatian time and group month-boundary terms into the local execution month',()=>{
 const v=colloquiumSchema.parse(values);assert.equal(v.starts_at,'2026-12-15T09:00:00.000Z');assert.equal(v.capacity,30);
 assert.equal(colloquiumMonth('2026-11-30T23:30:00Z'),'2026-12');assert.equal(colloquiumMonth('2026-06-30T22:30:00Z'),'2026-07');
});
test('colloquium deadlines and capacity are validated independently of final exams',()=>{
 assert.ok(!colloquiumSchema.safeParse({...values,registration_deadline:'2026-12-16T10:00'}).success);
 assert.ok(!colloquiumSchema.safeParse({...values,withdrawal_deadline:'2026-12-16T10:00'}).success);
 assert.ok(!colloquiumSchema.safeParse({...values,capacity:'0'}).success);
});
