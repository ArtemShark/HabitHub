import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import React, { useState } from "react";
import { HabitFormData } from "../dto/Habit";

export default function HabitFormModal({
  open,
  initialData,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialData: HabitFormData;
  onClose: () => void;
  onSubmit: (data: HabitFormData) => void;
}) {
  const [form, setForm] = useState<HabitFormData>(initialData);

  React.useEffect(() => {
    setForm(initialData);
  }, [initialData]);

  const isValueType = form.type === "quantitative";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    setForm(initialData);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2"
          >
            <div className="rounded-[30px] border border-white/10 bg-[#0B1018]/95 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Edit Habit</h3>
                  <p className="mt-1 text-sm text-white/50">
                    Update the habit details below.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm text-white/65">Habit Name</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/65">Habit Type</label>
                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                    >
                      <option value="binary" className="bg-[#0B1018]">Binary</option>
                      <option value="quantitative" className="bg-[#0B1018]">Quantitative</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/65">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={form.endDate}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                    />
                  </div>

                  {isValueType && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm text-white/65">Goal</label>
                        <input
                          type="number"
                          name="goal"
                          value={form.goal}
                          onChange={handleChange}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-white/65">Unit</label>
                        <input
                          name="unit"
                          value={form.unit}
                          onChange={handleChange}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}