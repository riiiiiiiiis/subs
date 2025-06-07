import { useState, useEffect } from "react";

export type Subscription = {
  id: number;
  title: string;
  amount: number;
  startDate: string;
  period: number;
};

export function useLocalSubscriptions() {
  // Инициализируем состояние пустым массивом для обеспечения одинакового рендера на сервере и клиенте
  const [subs, setSubs] = useState<Subscription[]>([]);
  // Отслеживаем, был ли компонент смонтирован на клиенте
  const [isClientMounted, setIsClientMounted] = useState(false);

  useEffect(() => {
    // Этот эффект выполнится только на клиенте после первого рендера
    setIsClientMounted(true);
    try {
      const storedSubs = localStorage.getItem("subscriptions");
      if (storedSubs) {
        setSubs(JSON.parse(storedSubs));
      }
    } catch (error) {
      console.error("Failed to parse subscriptions from localStorage:", error);
      // В случае ошибки парсинга, оставляем subs пустым массивом
    }
  }, []); // Пустой массив зависимостей - запуск один раз после монтирования

  useEffect(() => {
    // Сохраняем в localStorage только на клиенте и если состояние subs изменилось
    if (isClientMounted) {
      localStorage.setItem("subscriptions", JSON.stringify(subs));
    }
  }, [subs, isClientMounted]);

  return { subs, setSubs, isClientMounted };
}