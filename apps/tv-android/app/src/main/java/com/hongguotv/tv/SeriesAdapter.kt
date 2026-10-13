package com.hongguotv.tv

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ProgressBar
import androidx.recyclerview.widget.RecyclerView

internal class SeriesAdapter(
    private val rows: List<Series>, private val artwork: ArtworkLoader,
    private val selected: (Series) -> Unit, private val focused: (Series) -> Unit,
    private val subtitle: (Series) -> String = { it.badge },
    private val progress: (Series) -> Float? = { null }
) : RecyclerView.Adapter<SeriesAdapter.Holder>() {
    class Holder(
        val card: LinearLayout,
        val imageContainer: FrameLayout,
        val image: ImageView,
        val rankBadge: TextView,
        val title: TextView,
        val badge: TextView,
        val progress: ProgressBar
    ) : RecyclerView.ViewHolder(card)

    init { setHasStableIds(true) }
    override fun getItemId(position: Int) = rows[position].id.toLongOrNull() ?: rows[position].id.hashCode().toLong()
    override fun getItemCount() = rows.size
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val context = parent.context
        val card = TvUi.column(context).apply {
            isFocusable = true; isClickable = true
            background = TvUi.focusBackground(radius = 12f)
            setPadding(TvUi.dp(context, 8), TvUi.dp(context, 8), TvUi.dp(context, 8), TvUi.dp(context, 8))
            layoutParams = RecyclerView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                TvUi.dp(context, 345)
            ).apply {
                setMargins(TvUi.dp(context, 8), TvUi.dp(context, 8), TvUi.dp(context, 8), TvUi.dp(context, 8))
            }
        }

        // Image with rounded corners & rank badge container
        val imageContainer = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                setColor(0xff1e293b.toInt())
                cornerRadius = TvUi.dp(context, 8).toFloat()
            }
        }
        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
        }
        imageContainer.addView(image, FrameLayout.LayoutParams(-1, -1))

        // Rank Badge (for Top rankings)
        val rankBadge = TextView(context).apply {
            textSize = 11f; setTextColor(Color.WHITE); setTypeface(typeface, Typeface.BOLD)
            setPadding(TvUi.dp(context, 6), TvUi.dp(context, 2), TvUi.dp(context, 6), TvUi.dp(context, 2))
            visibility = android.view.View.GONE
        }
        imageContainer.addView(rankBadge, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.START))

        card.addView(imageContainer, LinearLayout.LayoutParams(-1, TvUi.dp(context, 230)))

        val title = TextView(context).apply {
            textSize = 14f; setTextColor(Color.WHITE); maxLines = 2; minLines = 2
            setPadding(TvUi.dp(context, 4), TvUi.dp(context, 6), TvUi.dp(context, 4), TvUi.dp(context, 2))
            setTypeface(typeface, Typeface.BOLD)
        }
        val badge = TextView(context).apply {
            textSize = 12f; setTextColor(TvUi.AMBER)
            setPadding(TvUi.dp(context, 4), 0, TvUi.dp(context, 4), TvUi.dp(context, 4))
        }
        card.addView(title)
        card.addView(badge)
        val progress = ProgressBar(context,null,android.R.attr.progressBarStyleHorizontal).apply{max=1000;visibility=android.view.View.GONE}
        card.addView(progress,LinearLayout.LayoutParams(-1,TvUi.dp(context,4)))

        return Holder(card, imageContainer, image, rankBadge, title, badge,progress)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val series = rows[position]
        holder.title.text = series.title
        holder.badge.text = subtitle(series)
        holder.card.contentDescription = "${series.title}，${subtitle(series)}"
        val value=progress(series);holder.progress.visibility=if(value==null)android.view.View.GONE else android.view.View.VISIBLE
        holder.progress.progress=((value?:0f).coerceIn(0f,1f)*1000).toInt()

        // Ranking badges if index < 10
        if (position < 10 && series.badge.contains("榜")) {
            holder.rankBadge.visibility = android.view.View.VISIBLE
            holder.rankBadge.text = "Top ${position + 1}"
            val bgGradient = when (position) {
                0 -> intArrayOf(0xffffd700.toInt(), 0xfff59e0b.toInt()) // Gold
                1 -> intArrayOf(0xffe2e8f0.toInt(), 0xff94a3b8.toInt()) // Silver
                2 -> intArrayOf(0xfff97316.toInt(), 0xffea580c.toInt()) // Bronze
                else -> intArrayOf(0xcc1e293b.toInt(), 0xaa0f172a.toInt())
            }
            holder.rankBadge.background = GradientDrawable(GradientDrawable.Orientation.TL_BR, bgGradient).apply {
                cornerRadius = TvUi.dp(holder.itemView.context, 6).toFloat()
            }
        } else {
            holder.rankBadge.visibility = android.view.View.GONE
        }

        holder.card.setOnClickListener { selected(series) }
        holder.card.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                focused(series)
                holder.card.scaleX = 1.04f
                holder.card.scaleY = 1.04f
            } else {
                holder.card.scaleX = 1f
                holder.card.scaleY = 1f
            }
        }
        artwork.load(series.cover, holder.image)
    }
}
