import { useAuth } from "@/contexts/AuthContext";
import cc from "currency-codes";

const currencyCodes = cc.codes();

export const useCurrencyCodes = () => {
  const { user } = useAuth();
  const homeCurrency = user?.homeCurrency || "IDR";
  const sortedCurrencyCodes = currencyCodes.filter(
    (code) => code !== homeCurrency,
  );
  return [homeCurrency, ...sortedCurrencyCodes];
};

export const getCurrencyName = (code: string) =>
  cc.code(code)?.currency ?? code;
