"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Save, Plus, Trash2, Edit2, X } from "lucide-react";

type Outlet = { id: string; name: string; marking: string; country: string; address?: string; isHQ: boolean };
type User   = { id: string; name?: string; email: string; role: string; outletId?: string };
type Rate   = { id: string; fromCcy: string; toCcy: string; rate: number; setAt: string };

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAdmin = role === "admin";

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [users, setUsers]     = useState<User[]>([]);
  const [rate, setRate]       = useState<Rate | null>(null);
  const [newRate, setNewRate] = useState("0.62");
  const [saving, setSaving]   = useState(false);

  const [outletModal, setOutletModal] = useState(false);
  const [outletForm, setOutletForm]   = useState({ name:"", marking:"", country:"MY", address:"", isHQ:false });
  const [editOutlet, setEditOutlet]   = useState<Outlet | null>(null);
  const [editForm, setEditForm]       = useState({ name:"", marking:"", country:"MY", address:"", isHQ:false });
  const [userModal, setUserModal]     = useState(false);
  const [userForm, setUserForm]       = useState({ name:"", email:"", password:"", role:"buyer", outletId:"" });

  useEffect(() => {
    fetch("/api/outlets").then(r=>r.json()).then(setOutlets).catch(()=>{});
    if (isAdmin) {
      fetch("/api/users").then(r=>r.json()).then(setUsers).catch(()=>{});
      fetch("/api/exchange-rate").then(r=>r.json()).then((d)=>{ setRate(d); setNewRate(String(d.rate)); }).catch(()=>{});
    }
  }, [isAdmin]);

  async function saveRate() {
    setSaving(true);
    const res = await fetch("/api/exchange-rate", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ fromCcy:"RMB", toCcy:"RM", rate: parseFloat(newRate) }),
    });
    if (res.ok) { setRate(await res.json()); localStorage.setItem("rmbRate", newRate); }
    setSaving(false);
  }

  async function saveOutlet() {
    const res = await fetch("/api/outlets", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(outletForm),
    });
    if (res.ok) { const d = await res.json(); setOutlets(o => [...o, d]); setOutletModal(false); }
  }

  function openEditOutlet(o: Outlet) {
    setEditOutlet(o);
    setEditForm({ name: o.name, marking: o.marking, country: o.country, address: o.address ?? "", isHQ: o.isHQ });
  }

  async function updateOutlet() {
    if (!editOutlet) return;
    const res = await fetch(`/api/outlets/${editOutlet.id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const d = await res.json();
      setOutlets(prev => prev.map(o => o.id === d.id ? d : o));
      setEditOutlet(null);
    }
  }

  async function deleteOutlet(id: string) {
    if (!confirm("Remove this outlet?")) return;
    const res = await fetch(`/api/outlets/${id}`, { method:"DELETE" });
    if (res.ok) setOutlets(prev => prev.filter(o => o.id !== id));
  }

  async function saveUser() {
    const res = await fetch("/api/users", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(userForm),
    });
    if (res.ok) { const d = await res.json(); setUsers(u => [...u, d]); setUserModal(false); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage outlets, users, and exchange rates</p>
      </div>

      {/* Exchange Rate */}
      {isAdmin && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">RMB → RM Exchange Rate</h2>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Current Rate (1 RMB = ? RM)</label>
              <input className="input" type="number" step="0.001" value={newRate} onChange={e => setNewRate(e.target.value)} />
            </div>
            <button onClick={saveRate} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={14} /> {saving ? "Saving…" : "Save Rate"}
            </button>
          </div>
          {rate && <p className="text-xs text-gray-400 mt-2">Last set: {new Date(rate.setAt).toLocaleDateString("en-MY")}</p>}
          <p className="text-xs text-gray-400 mt-1">This rate is used across the app for cost calculations. Update it manually when exchange rates change.</p>
        </div>
      )}

      {/* Outlets */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Outlet Locations</h2>
          {isAdmin && (
            <button onClick={() => setOutletModal(true)} className="btn-secondary flex items-center gap-1 text-xs">
              <Plus size={13} /> Add Outlet
            </button>
          )}
        </div>
        <div className="space-y-2">
          {outlets.map(o => (
            <div key={o.id}
              onClick={() => openEditOutlet(o)}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors group">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{o.name}</span>
                  {o.isHQ && <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">HQ</span>}
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{o.country}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Marking: <span className="font-mono">{o.marking}</span></p>
                {o.address && <p className="text-xs text-gray-400">{o.address}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); openEditOutlet(o); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700">
                  <Edit2 size={14} />
                </button>
                {isAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteOutlet(o.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {outlets.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No outlets added yet.</p>}
        </div>
      </div>

      {/* Users (admin only) */}
      {isAdmin && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Team Members</h2>
            <button onClick={() => setUserModal(true)} className="btn-secondary flex items-center gap-1 text-xs">
              <Plus size={13} /> Add User
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                {["Name","Email","Role","Outlet"].map(h=>(
                  <th key={h} className="text-left pb-2 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="py-2 font-medium text-gray-900">{u.name ?? "-"}</td>
                  <td className="py-2 text-gray-600">{u.email}</td>
                  <td className="py-2 capitalize"><span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{u.role}</span></td>
                  <td className="py-2 text-gray-500">{outlets.find(o=>o.id===u.outletId)?.name ?? "-"}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Outlet Modal */}
      {outletModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Outlet</h2>
            <div className="space-y-4">
              <div><label className="label">Outlet Name *</label><input className="input" value={outletForm.name} onChange={e=>setOutletForm(f=>({...f,name:e.target.value}))} placeholder="Melaka Main Store" /></div>
              <div><label className="label">Marking Code * (unique ID for packing list)</label><input className="input" value={outletForm.marking} onChange={e=>setOutletForm(f=>({...f,marking:e.target.value}))} placeholder="JN75-H2UHQ" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Country</label>
                  <select className="input" value={outletForm.country} onChange={e=>setOutletForm(f=>({...f,country:e.target.value}))}>
                    <option value="MY">Malaysia</option>
                    <option value="TH">Thailand</option>
                  </select>
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={outletForm.isHQ} onChange={e=>setOutletForm(f=>({...f,isHQ:e.target.checked}))} />
                    This is HQ
                  </label>
                </div>
              </div>
              <div><label className="label">Address</label><input className="input" value={outletForm.address} onChange={e=>setOutletForm(f=>({...f,address:e.target.value}))} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setOutletModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveOutlet} className="btn-primary flex-1" disabled={!outletForm.name||!outletForm.marking}>Save Outlet</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Outlet Modal */}
      {editOutlet && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Outlet</h2>
              <button onClick={() => setEditOutlet(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Outlet Name *</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div>
                <label className="label">Marking Code *</label>
                <input className="input" value={editForm.marking} onChange={e => setEditForm(f => ({...f, marking: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Country</label>
                  <select className="input" value={editForm.country} onChange={e => setEditForm(f => ({...f, country: e.target.value}))}>
                    <option value="MY">Malaysia</option>
                    <option value="TH">Thailand</option>
                  </select>
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editForm.isHQ} onChange={e => setEditForm(f => ({...f, isHQ: e.target.checked}))} />
                    This is HQ
                  </label>
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input" value={editForm.address} onChange={e => setEditForm(f => ({...f, address: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditOutlet(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={updateOutlet} className="btn-primary flex-1" disabled={!editForm.name || !editForm.marking}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {userModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Team Member</h2>
            <div className="space-y-4">
              <div><label className="label">Full Name</label><input className="input" value={userForm.name} onChange={e=>setUserForm(f=>({...f,name:e.target.value}))} /></div>
              <div><label className="label">Email *</label><input className="input" type="email" value={userForm.email} onChange={e=>setUserForm(f=>({...f,email:e.target.value}))} /></div>
              <div><label className="label">Password *</label><input className="input" type="password" value={userForm.password} onChange={e=>setUserForm(f=>({...f,password:e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Role</label>
                  <select className="input" value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))}>
                    <option value="admin">Admin</option>
                    <option value="buyer">Buyer</option>
                    <option value="operation">Operation</option>
                    <option value="finance">Finance</option>
                    <option value="warehouse">Warehouse</option>
                  </select>
                </div>
                <div><label className="label">Outlet (optional)</label>
                  <select className="input" value={userForm.outletId} onChange={e=>setUserForm(f=>({...f,outletId:e.target.value}))}>
                    <option value="">All outlets</option>
                    {outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setUserModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveUser} className="btn-primary flex-1" disabled={!userForm.email||!userForm.password}>Add User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
