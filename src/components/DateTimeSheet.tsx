// Calendar + time picker in a bottom sheet. Pure JS, so it needs no extra
// native module or rebuild.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/design/tokens';
import { Button, IconButton, Sheet, Text } from './ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onChange: (date: Date) => void;
  /** Latest selectable moment (defaults to now: expenses aren't in the future). */
  maxDate?: Date;
}

export function DateTimeSheet({ visible, value, onClose, onChange, maxDate }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Date & time">
      {visible ? <DateTimeBody value={value} onClose={onClose} onChange={onChange} maxDate={maxDate} /> : null}
    </Sheet>
  );
}

function DateTimeBody({ value, onClose, onChange, maxDate }: Omit<Props, 'visible'>) {
  const limit = maxDate ?? new Date();
  const [draft, setDraft] = useState(() => new Date(value));
  const [cursor, setCursor] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const limitDay = new Date(limit.getFullYear(), limit.getMonth(), limit.getDate()).getTime();
  const canGoNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime() <= limit.getTime();
  const today = new Date();

  const pickDay = (day: number) => {
    const next = new Date(draft);
    next.setFullYear(cursor.getFullYear(), cursor.getMonth(), day);
    setDraft(next);
  };

  const hours12 = draft.getHours() % 12 === 0 ? 12 : draft.getHours() % 12;
  const isPm = draft.getHours() >= 12;

  // Steppers wrap within the chosen day: only the time-of-day moves.
  const shiftHour = (delta: number) => {
    const next = new Date(draft);
    next.setHours((draft.getHours() + delta + 24) % 24);
    setDraft(next);
  };
  const shiftMinute = (delta: number) => {
    const next = new Date(draft);
    const rounded = Math.round(draft.getMinutes() / 5) * 5;
    next.setMinutes((rounded + delta + 60) % 60, 0, 0);
    setDraft(next);
  };

  const setMeridiem = (pm: boolean) => {
    if (pm === isPm) return;
    const next = new Date(draft);
    next.setHours(draft.getHours() + (pm ? 12 : -12));
    setDraft(next);
  };

  const quick = (daysAgo: number) => {
    const next = new Date();
    if (daysAgo > 0) {
      next.setDate(next.getDate() - daysAgo);
      next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
    }
    setDraft(next);
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const confirm = () => {
    onChange(draft.getTime() > limit.getTime() ? new Date(limit) : draft);
    onClose();
  };

  return (
    <View>
      <View style={styles.quickRow}>
        {[
          { label: 'Now', days: 0 },
          { label: 'Yesterday', days: 1 },
          { label: '2 days ago', days: 2 },
        ].map((q) => (
          <Pressable key={q.label} onPress={() => quick(q.days)} style={({ pressed }) => [styles.quick, pressed && styles.quickPressed]}>
            <Text variant="labelStrong" color={colors.brand}>
              {q.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.monthRow}>
        <IconButton
          icon="chevronLeft"
          size={36}
          background={colors.surfaceMuted}
          accessibilityLabel="Previous month"
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        />
        <Text variant="heading">{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
        <IconButton
          icon="chevronRight"
          size={36}
          background={colors.surfaceMuted}
          color={canGoNext ? colors.text : colors.textDisabled}
          disabled={!canGoNext}
          accessibilityLabel="Next month"
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        />
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} variant="caption" align="center" style={styles.cell}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((row, ri) => (
        <View key={ri} style={styles.week}>
          {row.map((day, ci) => {
            if (day === null) return <View key={ci} style={styles.cell} />;
            const ts = new Date(cursor.getFullYear(), cursor.getMonth(), day).getTime();
            const disabled = ts > limitDay;
            const selected =
              draft.getFullYear() === cursor.getFullYear() && draft.getMonth() === cursor.getMonth() && draft.getDate() === day;
            const isToday =
              today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth() && today.getDate() === day;
            return (
              <Pressable
                key={ci}
                disabled={disabled}
                onPress={() => pickDay(day)}
                style={styles.cell}
                accessibilityLabel={new Date(ts).toDateString()}
              >
                <View style={[styles.day, selected && styles.daySelected, !selected && isToday && styles.dayToday]}>
                  <Text
                    variant="labelStrong"
                    color={selected ? colors.textOnBrand : disabled ? colors.textDisabled : colors.text}
                  >
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.timeRow}>
        <View style={styles.stepper}>
          <IconButton icon="chevronLeft" size={30} background={colors.surface} accessibilityLabel="Hour earlier" onPress={() => shiftHour(-1)} />
          <Text variant="heading" numeric style={styles.timeText}>
            {hours12}
          </Text>
          <IconButton icon="chevronRight" size={30} background={colors.surface} accessibilityLabel="Hour later" onPress={() => shiftHour(1)} />
        </View>
        <Text variant="heading">:</Text>
        <View style={styles.stepper}>
          <IconButton icon="chevronLeft" size={30} background={colors.surface} accessibilityLabel="Minutes earlier" onPress={() => shiftMinute(-5)} />
          <Text variant="heading" numeric style={styles.timeText}>
            {String(draft.getMinutes()).padStart(2, '0')}
          </Text>
          <IconButton icon="chevronRight" size={30} background={colors.surface} accessibilityLabel="Minutes later" onPress={() => shiftMinute(5)} />
        </View>
        <View style={styles.meridiem}>
          {(['AM', 'PM'] as const).map((m) => {
            const active = (m === 'PM') === isPm;
            return (
              <Pressable key={m} onPress={() => setMeridiem(m === 'PM')} style={[styles.meridiemOpt, active && styles.meridiemActive]}>
                <Text variant="labelStrong" color={active ? colors.text : colors.textTertiary}>
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button title="Done" size="lg" fullWidth onPress={confirm} style={{ marginTop: space.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: 'row',
    gap: space.xs,
    marginBottom: space.md,
  },
  quick: {
    paddingHorizontal: space.sm,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  quickPressed: {
    backgroundColor: colors.brandSoftBorder,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  week: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: colors.brand,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 3,
  },
  timeText: {
    minWidth: 30,
    textAlign: 'center',
  },
  meridiem: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
  },
  meridiemOpt: {
    paddingHorizontal: space.sm,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  meridiemActive: {
    backgroundColor: colors.surface,
  },
});
