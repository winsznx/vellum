import { Topbar } from "../Topbar";
import styles from "./products.module.css";
import { PayoffSurface } from "./PayoffSurface";
import { publicClient } from "@/lib/viem";
import { VELLUM_SEPOLIA, NOTE_ABI, shortAddr } from "@/lib/vellum";

export const revalidate = 30;

const NOTE_ID = 0n; // hardened V4 gold-leg note (XAU/USD), settled + claimed on Sepolia

type NoteView = {
  principal: bigint; cap: bigint; refEnd: bigint; settled: boolean; claimed: boolean; payoffHandle: string; holder: string;
};

async function readNote(): Promise<NoteView | null> {
  const client = publicClient();
  try {
    const n = (await client.readContract({
      address: VELLUM_SEPOLIA.confidentialNoteV3 as `0x${string}`,
      abi: NOTE_ABI,
      functionName: "notes",
      args: [NOTE_ID],
    })) as readonly unknown[];
    const payoffHandle = (await client.readContract({
      address: VELLUM_SEPOLIA.confidentialNoteV3 as `0x${string}`,
      abi: NOTE_ABI,
      functionName: "getPayoff",
      args: [NOTE_ID],
    })) as string;
    return {
      holder: n[1] as string,
      principal: n[2] as bigint,
      cap: n[3] as bigint,
      refEnd: n[8] as bigint,
      settled: n[10] as boolean,
      claimed: n[11] as boolean,
      payoffHandle,
    };
  } catch {
    return null;
  }
}

export default async function ProductsPage() {
  const note = await readNote();
  const settled = note?.settled ?? false;
  const refEndUsd = note ? (Number(note.refEnd) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—";

  return (
    <>
      <Topbar crumb={<><b>Products</b> &nbsp;/&nbsp; <span className={styles.here}>Gold-Linked PPN</span></>} />
      <div className={styles.content}>
        <div className={styles.noteHead}>
          <div className={styles.noteTitle}>
            <h1>Gold-Linked Principal-Protected Note</h1>
            <div className={styles.sub}>
              <span>Note&nbsp;<span className="mono">#{NOTE_ID.toString()}</span></span>
              <span>Ref&nbsp;<span className="mono">XAU/USD</span> · Principal&nbsp;<span className="mono">cUSDT</span></span>
              <span>Holder&nbsp;<span className="mono">{note ? shortAddr(note.holder) : "—"}</span></span>
            </div>
          </div>
          {settled ? (
            <span className={`${styles.chip} ${styles.settled}`}><span className={styles.pip} />Matured · Settled</span>
          ) : (
            <span className={`${styles.chip} ${styles.sealedchip}`}><span className={styles.pip} />Sealed · Open</span>
          )}
        </div>

        <p className={styles.tagline}>
          The first confidential principal-protected structured note — principal protected, upside capped, and every
          term encrypted while the payoff computes on-chain.
        </p>

        <PayoffSurface
          principal6={(note?.principal ?? 0n).toString()}
          cap6={(note?.cap ?? 0n).toString()}
          refEndUsd={refEndUsd}
          payoffHandle={note?.payoffHandle ?? ""}
          claimed={note?.claimed ?? false}
          settled={settled}
          noteContract={VELLUM_SEPOLIA.confidentialNoteV3}
        />
      </div>
    </>
  );
}
