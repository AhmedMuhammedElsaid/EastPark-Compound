import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const IS_FIRST_TIME = "IS_FIRST_TIME";

export function useIsFirstTime() {
  const [isFirstTime, setIsFirstTimeState] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(IS_FIRST_TIME).then((val) => {
      if (val !== null)
        setIsFirstTimeState(JSON.parse(val) as boolean);
      setLoaded(true);
    });
  }, []);

  const setIsFirstTime = (val: boolean) => {
    setIsFirstTimeState(val);
    AsyncStorage.setItem(IS_FIRST_TIME, JSON.stringify(val));
  };

  if (!loaded)
    return [true, setIsFirstTime] as const;
  return [isFirstTime, setIsFirstTime] as const;
}
