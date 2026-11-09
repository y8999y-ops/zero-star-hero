// 多執行緒分工（取代 System.Threading.Tasks.Parallel.For）：
//   Parallel.For 每呼叫一次就產生約 6 KB 的暫存資料（工作、排程用的東西），一格畫面叫好幾次，手機清垃圾時會頓。
//   這裡開一組固定的工作執行緒一直留著，每次分工只喚醒它們，不產生新的東西。
//   用法一樣：Par.For(n, i => ...)，i 從 0 到 n-1，每個 i 剛好跑一次，全部跑完才回來。
//   分工方式跟 Parallel.For 一樣不保證順序，所以每個 i 只能寫自己那一塊（原本就是這樣用的），結果一樣。
using System;
using System.Threading;

namespace PixelFX
{
    public static class Par
    {
        static Thread[] threads;
        static SemaphoreSlim wake;
        static readonly ManualResetEventSlim done = new ManualResetEventSlim(false);
        static readonly object gate = new object();
        static Action<int> body;
        static int next, count, pending;
        static Exception error;
        [ThreadStatic] static bool inside;   // 分工中又叫 Par.For（巢狀）：直接一個一個跑

        static void Init()
        {
            int k = Math.Max(0, Math.Min(7, Environment.ProcessorCount - 1));
            wake = new SemaphoreSlim(0);
            threads = new Thread[k];
            for (int i = 0; i < k; i++)
            {
                threads[i] = new Thread(Loop) { IsBackground = true, Name = "PixelFX.Par " + i };
                threads[i].Start();
            }
        }

        static void Loop()
        {
            inside = true;
            while (true)
            {
                wake.Wait();
                Work();
                if (Interlocked.Decrement(ref pending) == 0) done.Set();
            }
        }

        static void Work()
        {
            int i;
            while ((i = Interlocked.Increment(ref next) - 1) < count)
            {
                try { body(i); }
                catch (Exception ex) { Interlocked.CompareExchange(ref error, ex, null); }
            }
        }

        public static void For(int n, Action<int> fn)
        {
            if (n <= 0) return;
            if (threads == null) lock (gate) if (threads == null) Init();
            if (n == 1 || inside || threads.Length == 0) { for (int i = 0; i < n; i++) fn(i); return; }
            lock (gate)
            {
                body = fn; count = n; next = 0; error = null;
                int w = Math.Min(threads.Length, n - 1);
                pending = w; done.Reset();
                wake.Release(w);
                inside = true;
                try { Work(); }
                finally { inside = false; }
                done.Wait();
                body = null;
                if (error != null) { var e = error; error = null; throw new AggregateException(e); }
            }
        }
    }
}
