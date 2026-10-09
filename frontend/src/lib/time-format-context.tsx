import { useQuery } from "@apollo/client/react";
import { createContext, type ReactNode, useContext } from "react";
import { AuthSessionDocument } from "@/graphql/graphql";

export const TimeFormatContext = createContext(false);

export function TimeFormatProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery(AuthSessionDocument);
  return (
    <TimeFormatContext value={data?.session.use12HourTime ?? false}>{children}</TimeFormatContext>
  );
}

export function useTwelveHourTime(): boolean {
  return useContext(TimeFormatContext);
}
