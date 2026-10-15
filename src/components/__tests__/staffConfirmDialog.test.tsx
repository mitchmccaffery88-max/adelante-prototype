// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
afterEach(cleanup);
function Host({onConfirm}: {onConfirm:(reason:string)=>boolean|Promise<boolean>}) {const [open,setOpen]=useState(true); return <ConfirmDialog open={open} onOpenChange={setOpen} title="Archive this lesson?" description="The lesson leaves the list. History remains; nobody is notified." confirmLabel="Archive lesson" keepLabel="Keep lesson" requireReason onConfirm={onConfirm}/>;}
describe("staff ConfirmDialog",()=>{
 it("focuses the safe choice and repeats the verb without destructive styling",()=>{render(<Host onConfirm={()=>true}/>); expect(document.activeElement).toBe(screen.getByRole("button",{name:"Keep lesson"})); expect(screen.getByRole("button",{name:"Archive lesson"}).className).not.toContain("destructive");});
 it("blocks blank reason then confirms once with trimmed reason",async()=>{const action=vi.fn(()=>true); render(<Host onConfirm={action}/>); fireEvent.click(screen.getByRole("button",{name:"Archive lesson"})); expect(action).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toBeTruthy(); fireEvent.change(screen.getByRole("textbox"),{target:{value:"  Reviewed  "}}); fireEvent.click(screen.getByRole("button",{name:"Archive lesson"})); await waitFor(()=>expect(action).toHaveBeenCalledTimes(1)); expect(action).toHaveBeenCalledWith("Reviewed");});
 it("cancels without executing the action",()=>{const action=vi.fn(()=>true);render(<Host onConfirm={action}/>); fireEvent.click(screen.getByRole("button",{name:"Keep lesson"})); expect(action).not.toHaveBeenCalled(); expect(screen.queryByRole("alertdialog")).toBeNull();});
 it("keeps reason on refusal and guards double clicks",async()=>{let finish:((value:boolean)=>void)|undefined; const action=vi.fn(()=>new Promise<boolean>(resolve=>{finish=resolve;})); render(<Host onConfirm={action}/>); fireEvent.change(screen.getByRole("textbox"),{target:{value:"Reviewed"}}); const confirm=screen.getByRole("button",{name:"Archive lesson"});fireEvent.click(confirm);fireEvent.click(confirm);expect(action).toHaveBeenCalledTimes(1);finish?.(false);await waitFor(()=>expect((confirm as HTMLButtonElement).disabled).toBe(false));expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Reviewed");});
});
