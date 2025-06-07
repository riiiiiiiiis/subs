"use client";
import { useState, useEffect, useMemo } from "react";
import { useLocalSubscriptions, Subscription } from "./useLocalSubscriptions";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';

// Регистрация компонентов Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, Title);

// Константа для курса обмена USD к RUB
const EXCHANGE_RATE_USD_TO_RUB = 90.0;

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

  // Расчет общей стоимости всех подписок в USD
  const totalUsdCost = useMemo(() => {
    return subs.reduce((sum, s) => sum + s.amount, 0);
  }, [subs]);

  // Расчет общей стоимости в RUB
  const totalRubCost = useMemo(() => {
    return totalUsdCost * EXCHANGE_RATE_USD_TO_RUB;
  }, [totalUsdCost]);

  // Данные для круговой диаграммы (подписки с платежами в текущем месяце)
  const chartDataForCurrentMonth = useMemo(() => {
    if (!isClientMounted) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1);
    const firstDayNextMonth = new Date(currentYear, currentMonth + 1, 1);

    const currentMonthSubscriptions: { title: string; amount: number }[] = [];

    subs.forEach(s => {
      const startDate = new Date(s.startDate);
      let paymentDate = new Date(startDate);

      while (paymentDate.getTime() < firstDayNextMonth.getTime()) {
        if (paymentDate.getTime() >= firstDayCurrentMonth.getTime()) {
          currentMonthSubscriptions.push({ title: s.title, amount: s.amount });
          break; // Для диаграммы достаточно одного вхождения в месяц
        }
        paymentDate.setDate(paymentDate.getDate() + s.period);
      }
    });

    const labels = currentMonthSubscriptions.map(sub => sub.title);
    const data = currentMonthSubscriptions.map(sub => sub.amount);

    // Цвета для диаграммы
    const backgroundColor = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
      '#9966FF', '#FF9F40', '#FF6B6B', '#4ECDC4'
    ];

    return {
      labels,
      datasets: [{
        label: 'Расходы за текущий месяц (USD)',
        data,
        backgroundColor: backgroundColor.slice(0, data.length),
        borderColor: backgroundColor.slice(0, data.length).map(color => color + 'CC'),
        borderWidth: 1,
      }]
    };
  }, [subs, isClientMounted]);

  // Настройки диаграммы
  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Расходы на подписки за текущий месяц (USD)',
      },
    },
  };

  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">📅 Подписки</h1>

      {/* Отображение общих сумм */}
      {isClientMounted && subs.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-green-900">Общая стоимость подписок:</h2>
          <p className="text-lg text-green-800">USD: ${totalUsdCost.toFixed(2)}</p>
          <p className="text-lg text-green-800">
            RUB: {totalRubCost.toFixed(2)} ₽ (по курсу {EXCHANGE_RATE_USD_TO_RUB} USD/RUB)
          </p>
        </div>
      )}

      {/* Круговая диаграмма */}
      {isClientMounted && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-blue-900">Распределение расходов за текущий месяц:</h2>
          {chartDataForCurrentMonth.datasets[0].data.length > 0 ? (
            <div className="w-full max-w-md mx-auto">
              <Pie options={pieChartOptions} data={chartDataForCurrentMonth} />
            </div>
          ) : (
            <p className="text-blue-700">Нет данных о платежах за текущий месяц для отображения диаграммы.</p>
          )}
        </div>
      )}

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