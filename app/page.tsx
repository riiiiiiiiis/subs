"use client";
import { useState, useEffect } from "react";
import { useLocalSubscriptions, Subscription } from "./useLocalSubscriptions";

export default function Page() {
  const { subs, setSubs, isClientMounted } = useLocalSubscriptions();
  // Инициализируем form с пустым startDate для предотвращения проблем с гидратацией
  const [form, setForm] = useState<Partial<Subscription>>({
    startDate: "",
    period: 30,
  });
  const [, setUpdateTrigger] = useState(0);

  // Устанавливаем текущую дату для новых форм только после монтирования на клиенте
  useEffect(() => {
    if (isClientMounted && !form.id && !form.startDate) {
      setForm(prevForm => ({
        ...prevForm,
        startDate: new Date().toISOString().slice(0, 10)
      }));
    }
  }, [isClientMounted, form.id, form.startDate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const save = () => {
    if (!form.title || !form.amount) return;
    const id = form.id ?? Date.now();
    const next: Subscription = { ...form, id } as Subscription;
    setSubs(prev =>
      prev.some(s => s.id === id)
        ? prev.map(s => (s.id === id ? next : s))
        : [...prev, next],
    );
    // Сбрасываем форму с пустым startDate, он будет установлен через useEffect
    setForm({ startDate: "", period: 30 });
  };

  const daysLeft = (s: Subscription) =>
    Math.ceil(
      (new Date(s.startDate).getTime() + s.period * 86_400_000 - Date.now()) /
        86_400_000,
    );

  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">📅 Подписки</h1>

      <div className="space-y-2 mb-6">
        <input
          className="border p-2 w-full"
          placeholder="Название"
          value={form.title ?? ""}
          onChange={e => setForm({ ...form, title: e.target.value })}
        />
        <input
          type="number"
          className="border p-2 w-full"
          placeholder="Сумма"
          value={form.amount ?? ""}
          onChange={e => setForm({ ...form, amount: +e.target.value })}
        />
        <input
          type="date"
          className="border p-2 w-full"
          value={form.startDate}
          onChange={e => setForm({ ...form, startDate: e.target.value })}
        />
        <input
          type="number"
          className="border p-2 w-full"
          placeholder="Период (дней)"
          value={form.period}
          onChange={e => setForm({ ...form, period: +e.target.value })}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={save}
        >
          Сохранить
        </button>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Название</th>
            <th className="p-2 text-left">Сумма</th>
            <th className="p-2 text-left">Осталось дней</th>
          </tr>
        </thead>
        <tbody>
          {!isClientMounted && (
            <tr>
              <td colSpan={3} className="p-2 text-center text-gray-500">
                Загрузка подписок...
              </td>
            </tr>
          )}
          {isClientMounted && subs.length === 0 && (
            <tr>
              <td colSpan={3} className="p-2 text-center text-gray-500">
                Нет подписок. Добавьте первую.
              </td>
            </tr>
          )}
          {isClientMounted && subs.map(s => (
            <tr
              key={s.id}
              className="border-t hover:bg-gray-50 cursor-pointer"
              onClick={() => setForm(s)}
            >
              <td className="p-2">{s.title}</td>
              <td className="p-2">{s.amount}</td>
              <td className="p-2">{daysLeft(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}